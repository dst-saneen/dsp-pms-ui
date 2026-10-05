import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import pg from 'pg';

import { QA_STAGING_TARGET } from '../assert-destructive-db-guard';
import {
  AppliedMigration,
  compareMigrationLineage,
  MigrationLineageComparison,
  readRepositoryMigrations,
  RepositoryMigration,
} from './migration-lineage';

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

type RuntimeTargetRow = {
  databaseName: string;
  databaseSchema: string | null;
  databaseUser: string;
  schemaExists: boolean;
  schemaUsage: boolean;
  schemaCreate: boolean;
};

type SchemaSummaryRow = {
  columnCount: number;
  indexCount: number;
  tableCount: number;
};

type SchemaObjectRow = {
  objectDefinition: string;
  objectName: string;
  objectType: string;
};

type MigrationSummaryRow = {
  appliedCount: number;
  failedCount: number;
  migrationCount: number;
};

type MigrationAudit = {
  appliedMigrations: AppliedMigration[];
  lineage: MigrationLineageComparison | null;
  migrations: MigrationSummaryRow | null;
  tableExists: boolean;
};

function requiredEnvironment(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function assertReadOnlyTarget(env: Environment): URL {
  const databaseName = requiredEnvironment(env, 'DATABASE_NAME').toLowerCase();
  const databaseUser = requiredEnvironment(env, 'DATABASE_USER').toLowerCase();
  const databaseSchema = requiredEnvironment(
    env,
    'DATABASE_SCHEMA',
  ).toLowerCase();

  if (
    databaseName !== QA_STAGING_TARGET.databaseName ||
    databaseUser !== QA_STAGING_TARGET.databaseUser ||
    databaseSchema !== QA_STAGING_TARGET.databaseSchema
  ) {
    throw new Error(
      'Read-only staging audit requires the exact dsp_erp_dev/dscape/dsp_pms_stg target.',
    );
  }

  const runtimeUrl = new URL(
    requiredEnvironment(env, 'DATABASE_URL').replace(
      /^postgres(?:ql)?\+asyncpg:\/\//i,
      'postgresql://',
    ),
  );
  const urlDatabase = decodeURIComponent(
    runtimeUrl.pathname.replace(/^\//, ''),
  );
  const urlUser = decodeURIComponent(runtimeUrl.username);
  const urlSchema = runtimeUrl.searchParams.get('schema')?.trim();

  if (urlDatabase.toLowerCase() !== databaseName) {
    throw new Error('DATABASE_URL database does not match DATABASE_NAME.');
  }
  if (urlUser.toLowerCase() !== databaseUser) {
    throw new Error('DATABASE_URL user does not match DATABASE_USER.');
  }
  if (urlSchema && urlSchema.toLowerCase() !== databaseSchema) {
    throw new Error('DATABASE_URL schema does not match DATABASE_SCHEMA.');
  }

  runtimeUrl.searchParams.delete('schema');
  return runtimeUrl;
}

async function readSchemaSummary(
  client: pg.PoolClient,
  schema: string,
): Promise<SchemaSummaryRow> {
  const result = await client.query<SchemaSummaryRow>(
    `SELECT
       (SELECT COUNT(*)::int
          FROM information_schema.tables
         WHERE table_schema = $1) AS "tableCount",
       (SELECT COUNT(*)::int
          FROM information_schema.columns
         WHERE table_schema = $1) AS "columnCount",
       (SELECT COUNT(*)::int
          FROM pg_catalog.pg_indexes
         WHERE schemaname = $1) AS "indexCount"`,
    [schema],
  );
  return result.rows[0] ?? { tableCount: 0, columnCount: 0, indexCount: 0 };
}

async function readSchemaFingerprint(
  client: pg.PoolClient,
  schema: string,
): Promise<string> {
  const result = await client.query<SchemaObjectRow>(
    `SELECT object_type AS "objectType",
            object_name AS "objectName",
            object_definition AS "objectDefinition"
       FROM (
         SELECT 'column'::text AS object_type,
                table_name || '.' || column_name AS object_name,
                data_type || ':' || is_nullable || ':' || COALESCE(column_default, '') AS object_definition
           FROM information_schema.columns
          WHERE table_schema = $1
         UNION ALL
         SELECT 'index'::text, indexname, indexdef
           FROM pg_catalog.pg_indexes
          WHERE schemaname = $1
       ) objects
      ORDER BY object_type, object_name, object_definition`,
    [schema],
  );
  return createHash('sha256').update(JSON.stringify(result.rows)).digest('hex');
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function readMigrationAudit(
  client: pg.PoolClient,
  schema: string,
  repositoryMigrations: RepositoryMigration[],
): Promise<MigrationAudit> {
  const relationResult = await client.query<{ tableExists: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS "tableExists"',
    [`${schema}._prisma_migrations`],
  );
  const tableExists = relationResult.rows[0]?.tableExists ?? false;
  if (!tableExists) {
    return {
      tableExists,
      migrations: null,
      appliedMigrations: [],
      lineage: null,
    };
  }

  const migrationResult = await client.query<MigrationSummaryRow>(
    `SELECT COUNT(*)::int AS "migrationCount",
            COUNT(*) FILTER (
              WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
            )::int AS "appliedCount",
            COUNT(*) FILTER (
              WHERE finished_at IS NULL AND rolled_back_at IS NULL
            )::int AS "failedCount"
       FROM ${quoteIdentifier(schema)}."_prisma_migrations"`,
  );
  const appliedResult = await client.query<AppliedMigration>(
    `SELECT migration_name AS "migrationName", checksum
       FROM ${quoteIdentifier(schema)}."_prisma_migrations"
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      ORDER BY migration_name, started_at`,
  );
  const appliedMigrations = appliedResult.rows;
  return {
    tableExists,
    migrations: migrationResult.rows[0] ?? null,
    appliedMigrations,
    lineage: compareMigrationLineage(repositoryMigrations, appliedMigrations),
  };
}

async function main(): Promise<void> {
  const executedAt = new Date().toISOString();
  const saveEvidence = process.argv.includes('--save-evidence');
  const migrationDirectory = resolve(process.cwd(), 'prisma', 'migrations');
  const repositoryMigrations = readRepositoryMigrations(migrationDirectory);
  const repositoryMigrationCount = repositoryMigrations.length;
  const runtimeUrl = assertReadOnlyTarget(process.env);
  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();
  if (sslCaPath) {
    runtimeUrl.searchParams.delete('sslmode');
  } else {
    const sslMode = process.env.DATABASE_SSL_MODE?.trim();
    if (sslMode) {
      runtimeUrl.searchParams.set('sslmode', sslMode);
    }
  }

  const pool = new pg.Pool({
    connectionString: runtimeUrl.toString(),
    ssl: sslCaPath
      ? {
          ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
          rejectUnauthorized: true,
        }
      : undefined,
    options: [
      `-c search_path=${QA_STAGING_TARGET.databaseSchema}`,
      '-c default_transaction_read_only=on',
      '-c statement_timeout=15000',
      '-c application_name=dsp_qa_staging_audit',
    ].join(' '),
  });

  const client = await pool.connect();
  try {
    const runtimeResult = await client.query<RuntimeTargetRow>(
      `SELECT current_database() AS "databaseName",
              current_schema() AS "databaseSchema",
              current_user AS "databaseUser",
              to_regnamespace($1) IS NOT NULL AS "schemaExists",
              CASE WHEN to_regnamespace($1) IS NOT NULL
                THEN has_schema_privilege(current_user, $1, 'USAGE')
                ELSE FALSE
              END AS "schemaUsage",
              CASE WHEN to_regnamespace($1) IS NOT NULL
                THEN has_schema_privilege(current_user, $1, 'CREATE')
                ELSE FALSE
              END AS "schemaCreate"`,
      [QA_STAGING_TARGET.databaseSchema],
    );
    const runtime = runtimeResult.rows[0];
    if (
      !runtime ||
      runtime.databaseName.toLowerCase() !== QA_STAGING_TARGET.databaseName ||
      runtime.databaseUser.toLowerCase() !== QA_STAGING_TARGET.databaseUser
    ) {
      throw new Error(
        'Connected database identity does not match the staging target.',
      );
    }

    const stagingSummary = await readSchemaSummary(
      client,
      QA_STAGING_TARGET.databaseSchema,
    );
    const currentSummary = await readSchemaSummary(
      client,
      QA_STAGING_TARGET.currentSchema,
    );
    const stagingFingerprint = await readSchemaFingerprint(
      client,
      QA_STAGING_TARGET.databaseSchema,
    );
    const currentFingerprint = await readSchemaFingerprint(
      client,
      QA_STAGING_TARGET.currentSchema,
    );

    const relationResult = await client.query<{
      sentinelTableExists: boolean;
    }>('SELECT to_regclass($1) IS NOT NULL AS "sentinelTableExists"', [
      `${QA_STAGING_TARGET.databaseSchema}.qa_environment_sentinel`,
    ]);
    const relations = relationResult.rows[0] ?? {
      sentinelTableExists: false,
    };
    const stagingMigrationAudit = await readMigrationAudit(
      client,
      QA_STAGING_TARGET.databaseSchema,
      repositoryMigrations,
    );
    const currentMigrationAudit = await readMigrationAudit(
      client,
      QA_STAGING_TARGET.currentSchema,
      repositoryMigrations,
    );

    let sentinelPresent = false;
    if (relations.sentinelTableExists) {
      const sentinelResult = await client.query<{ present: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM qa_environment_sentinel
            WHERE sentinel_key = $1
              AND database_name = current_database()
              AND schema_name = current_schema()
              AND enabled = TRUE
         ) AS present`,
        [QA_STAGING_TARGET.sentinelKey],
      );
      sentinelPresent = sentinelResult.rows[0]?.present ?? false;
    }

    const targetVerified =
      runtime.schemaExists &&
      runtime.databaseSchema?.toLowerCase() ===
        QA_STAGING_TARGET.databaseSchema &&
      runtime.schemaUsage;
    const migrationLedgerReady =
      stagingMigrationAudit.tableExists &&
      stagingMigrationAudit.migrations?.migrationCount ===
        repositoryMigrationCount &&
      stagingMigrationAudit.migrations.appliedCount ===
        repositoryMigrationCount &&
      stagingMigrationAudit.migrations.failedCount === 0 &&
      stagingMigrationAudit.lineage?.ready === true;
    const baselinePresent =
      targetVerified && stagingSummary.tableCount > 0 && migrationLedgerReady;
    const status = !targetVerified
      ? 'BLOCKED_SCHEMA_TARGET'
      : !baselinePresent
        ? 'BLOCKED_STRUCTURE_BASELINE'
        : sentinelPresent
          ? 'READY_FOR_REFERENCE_SEED'
          : 'READY_FOR_SENTINEL_BOOTSTRAP';

    const evidencePath = saveEvidence
      ? resolve(process.cwd(), '.qa-runs', `staging-audit-${Date.now()}.json`)
      : null;
    const evidence = {
      executedAt,
      mode: 'CONNECTED_READ_ONLY',
      status,
      repositoryMigrationCount,
      runtime,
      staging: {
        ...stagingSummary,
        fingerprint: stagingFingerprint,
        migrationTableExists: stagingMigrationAudit.tableExists,
        migrations: stagingMigrationAudit.migrations,
        migrationLineage: stagingMigrationAudit.lineage,
        sentinelTableExists: relations.sentinelTableExists,
        sentinelPresent,
      },
      current: {
        ...currentSummary,
        fingerprint: currentFingerprint,
        migrationTableExists: currentMigrationAudit.tableExists,
        migrations: currentMigrationAudit.migrations,
        migrationLineage: currentMigrationAudit.lineage,
      },
      evidencePath,
      note: 'The connection enforces default_transaction_read_only=on; this command cannot bootstrap, migrate, seed, or clean data.',
    };
    if (evidencePath) {
      mkdirSync(resolve(process.cwd(), '.qa-runs'), { recursive: true });
      writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
    }
    console.log(JSON.stringify(evidence, null, 2));

    if (!baselinePresent) {
      process.exitCode = 2;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
