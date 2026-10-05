/**
 * One-off, closed-scope repair for a verified staging lineage gap.
 *
 * It does not change the normal staging deploy guard. This script can write
 * only the four source-hash-pinned RBAC migrations in
 * staging-rbac-ledger-repair-plan.ts, and only into dsp_pms_stg after both QA
 * write guards pass. It intentionally has no migration-name, checksum, SQL,
 * schema, database, or row-count override flags.
 */
import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Pool, type PoolClient } from 'pg';

import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  createCanonicalStagingDatabaseUrl,
  readQaSchemaFingerprint,
  requiredEnv,
  type QaWriteTarget,
  type RawQueryClient,
} from '../assert-destructive-db-guard';
import {
  readRepositoryMigrations,
  type RepositoryMigration,
} from './migration-lineage';
import { inspectStagingMigrationLedger } from './staging-migration-deploy-plan';
import {
  assertPinnedStagingRbacMappingRows,
  assertPinnedStagingRbacMappingsMatchExpected,
  assertPinnedStagingRbacReferences,
  createStagingRbacLedgerRepairPlan,
  inspectCompletedStagingRbacLedgerRepair,
  inspectInitialStagingRbacLedgerRepair,
  readPinnedStagingRbacMigrationSql,
  STAGING_RBAC_PERMISSION_MAPPING_VALIDATION_SQL,
  STAGING_RBAC_REFERENCE_VALIDATION_SQL,
  STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS,
  type PinnedRbacMigrationSql,
  type RbacPermissionMappingRow,
  type RbacReferenceRow,
  type StagingRbacLedgerRow,
} from './staging-rbac-ledger-repair-plan';

const SCRIPT_NAME = 'qa:staging:repair-rbac-ledger';

/**
 * This transaction-scoped lock is deliberately a fixed value. It serializes
 * this exceptional repair while the normal deployment wrapper continues to
 * reject the historical gap. It is acquired after the staging sentinel check.
 */
const RBAC_LEDGER_REPAIR_ADVISORY_LOCK_SQL =
  'SELECT pg_advisory_xact_lock(72707369)';

const RBAC_LEDGER_REPAIR_TABLE_LOCK_SQL =
  'LOCK TABLE "_prisma_migrations", "roles", "permissions", "role_permissions" IN SHARE ROW EXCLUSIVE MODE';

/**
 * Provenance for these values: local Prisma 7.9.1 and successful staging
 * deploy rows. Since this tool executes the SQL itself, it emulates the final
 * successful-deploy ledger shape: UUID v4 ids, exact source checksums,
 * logs=NULL, rolled_back_at=NULL, one shared UTC timestamp, and
 * applied_steps_count=1. This fixed statement is not a general ledger writer.
 */
const INSERT_PINNED_SUCCESSFUL_DEPLOY_LEDGER_ROWS_SQL = `
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
VALUES
  ($1, 'a64cb1d53e855d4d99ac382bc013b51e400afcc67ca47014747d03050830a4cc', $5, '20260918093000_hr_manager_projects_permissions', NULL, NULL, $5, 1),
  ($2, '9e89cef2337838653b698b6f906c95c5afc2ad0b00d480b688055a74ce824168', $5, '20260918104500_hr_manager_finance_settings', NULL, NULL, $5, 1),
  ($3, '59d4212d79ad32634902a9af72a421847088973b924064062c2872189ff3627e', $5, '20260918113000_employee_projects_permissions_cleanup', NULL, NULL, $5, 1),
  ($4, 'f9ad224832010813091eb157d17e15c1de220f9aff49953dfa8ef66e6b386e6f', $5, '20260918140000_owner_delivery_ops_permissions', NULL, NULL, $5, 1)`;

type LedgerRelationRow = {
  migrationLedgerSchema: string | null;
};

type RepairVerification = {
  readonly ledgerRows: StagingRbacLedgerRow[];
  readonly mappingRows: RbacPermissionMappingRow[];
};

function createStagingPool(target: QaWriteTarget): Pool {
  const runtimeUrl = createCanonicalStagingDatabaseUrl(
    requiredEnv('DATABASE_URL'),
    target,
  );
  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();
  return new Pool({
    connectionString: runtimeUrl,
    ssl: sslCaPath
      ? {
          ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
          rejectUnauthorized: true,
        }
      : undefined,
    options: [
      `-c search_path=${target.databaseSchema}`,
      '-c application_name=dsp_qa_staging_rbac_ledger_repair',
      '-c statement_timeout=30000',
    ].join(' '),
  });
}

function createRawQueryClient(client: PoolClient): RawQueryClient {
  return {
    async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
      const result = await client.query(query, values as never[]);
      return result.rows as T;
    },
  };
}

async function readStagingMigrationLedger(
  client: PoolClient,
  target: QaWriteTarget,
): Promise<StagingRbacLedgerRow[]> {
  const relationResult = await client.query<LedgerRelationRow>(
    `SELECT namespace.nspname AS "migrationLedgerSchema"
       FROM pg_catalog.pg_class relation
       JOIN pg_catalog.pg_namespace namespace
         ON namespace.oid = relation.relnamespace
      WHERE relation.oid = to_regclass('_prisma_migrations')`,
  );
  const relation = relationResult.rows[0];
  if (!relation || relation.migrationLedgerSchema !== target.databaseSchema) {
    throw new Error(
      'The staging _prisma_migrations ledger is missing from the approved schema or resolved through an unsafe fallback.',
    );
  }

  const result = await client.query<StagingRbacLedgerRow>(
    `SELECT id,
            migration_name AS "migrationName",
            checksum,
            started_at AS "startedAt",
            finished_at AS "finishedAt",
            rolled_back_at AS "rolledBackAt",
            logs,
            applied_steps_count AS "appliedStepsCount"
       FROM "_prisma_migrations"
      ORDER BY migration_name, started_at, id`,
  );
  return result.rows;
}

async function readPinnedRbacReferences(
  client: PoolClient,
): Promise<RbacReferenceRow[]> {
  const result = await client.query<RbacReferenceRow>(
    STAGING_RBAC_REFERENCE_VALIDATION_SQL,
  );
  return result.rows;
}

async function readPinnedRbacMappings(
  client: PoolClient,
): Promise<RbacPermissionMappingRow[]> {
  const result = await client.query<RbacPermissionMappingRow>(
    STAGING_RBAC_PERMISSION_MAPPING_VALIDATION_SQL,
  );
  return result.rows;
}

async function verifyInitialRepairState(
  client: PoolClient,
  target: QaWriteTarget,
  repositoryMigrations: readonly RepositoryMigration[],
): Promise<RepairVerification> {
  await assertQaStagingSentinel(
    createRawQueryClient(client),
    SCRIPT_NAME,
    target,
  );
  const ledgerRows = await readStagingMigrationLedger(client, target);
  inspectInitialStagingRbacLedgerRepair(repositoryMigrations, ledgerRows);
  const referenceRows = await readPinnedRbacReferences(client);
  assertPinnedStagingRbacReferences(referenceRows);
  const mappingRows = await readPinnedRbacMappings(client);
  assertPinnedStagingRbacMappingRows(mappingRows);
  return { ledgerRows, mappingRows };
}

async function verifyCompletedRepairState(
  client: PoolClient,
  target: QaWriteTarget,
  repositoryMigrations: readonly RepositoryMigration[],
): Promise<RepairVerification> {
  await assertQaStagingSentinel(
    createRawQueryClient(client),
    SCRIPT_NAME,
    target,
  );
  const ledgerRows = await readStagingMigrationLedger(client, target);
  inspectCompletedStagingRbacLedgerRepair(repositoryMigrations, ledgerRows);
  const normalDeployPreflight = inspectStagingMigrationLedger(
    [...repositoryMigrations],
    ledgerRows,
  );
  if (normalDeployPreflight.pendingMigrations.length !== 0) {
    throw new Error(
      'RBAC ledger repair post-check found pending migrations after the completed ledger verification.',
    );
  }
  const referenceRows = await readPinnedRbacReferences(client);
  assertPinnedStagingRbacReferences(referenceRows);
  const mappingRows = await readPinnedRbacMappings(client);
  assertPinnedStagingRbacMappingsMatchExpected(mappingRows);
  return { ledgerRows, mappingRows };
}

async function applyPinnedRbacSqlAndLedgerRows(
  client: PoolClient,
  target: QaWriteTarget,
  repositoryMigrations: readonly RepositoryMigration[],
  pinnedSql: readonly PinnedRbacMigrationSql[],
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(RBAC_LEDGER_REPAIR_ADVISORY_LOCK_SQL);
    await client.query(RBAC_LEDGER_REPAIR_TABLE_LOCK_SQL);

    // Re-check after locks and immediately before the first mutation.
    await verifyInitialRepairState(client, target, repositoryMigrations);

    for (const migration of pinnedSql) {
      await client.query(migration.sql);
    }

    const referencesAfterSql = await readPinnedRbacReferences(client);
    assertPinnedStagingRbacReferences(referencesAfterSql);
    const mappingsAfterSql = await readPinnedRbacMappings(client);
    assertPinnedStagingRbacMappingsMatchExpected(mappingsAfterSql);

    await assertQaStagingSentinel(
      createRawQueryClient(client),
      SCRIPT_NAME,
      target,
    );
    const insertedAt = new Date();
    await client.query(INSERT_PINNED_SUCCESSFUL_DEPLOY_LEDGER_ROWS_SQL, [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      insertedAt,
    ]);

    // Re-read all pinned evidence while locks remain held. This proves the
    // intended 156 -> 160 transition and the final RBAC policy before commit.
    await verifyCompletedRepairState(client, target, repositoryMigrations);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure. A failed rollback still closes the pool.
    }
    throw error;
  }
}

/**
 * The post-commit evidence uses a new TCP connection rather than the
 * transaction connection. It repeats the same target, exact-160-lineage,
 * checksum, Prisma-row-shape, reference, and RBAC-effect proof before a
 * success status can be emitted.
 */
async function verifyCommittedRepairOnFreshConnection(
  target: QaWriteTarget,
  repositoryMigrations: readonly RepositoryMigration[],
): Promise<string> {
  const verificationPool = createStagingPool(target);
  try {
    const verificationClient = await verificationPool.connect();
    try {
      await verifyCompletedRepairState(
        verificationClient,
        target,
        repositoryMigrations,
      );
      return readQaSchemaFingerprint(createRawQueryClient(verificationClient));
    } finally {
      verificationClient.release();
    }
  } finally {
    await verificationPool.end();
  }
}

function writeNonSensitiveRepairEvidence(input: {
  completedAt: string;
  schemaFingerprintAfter: string;
  schemaFingerprintBefore: string;
  startedAt: string;
  target: QaWriteTarget;
}): string {
  if (input.schemaFingerprintBefore !== input.schemaFingerprintAfter) {
    throw new Error(
      'RBAC ledger repair changed the staging schema fingerprint; refusing to record success.',
    );
  }

  const evidenceDirectory = resolve(process.cwd(), '.qa-runs');
  mkdirSync(evidenceDirectory, { recursive: true });
  const evidencePath = resolve(
    evidenceDirectory,
    `staging-rbac-ledger-repair-${Date.now()}.json`,
  );
  const evidence = {
    completedAt: input.completedAt,
    mode: 'ATOMIC_STAGING_RBAC_LEDGER_REPAIR',
    status: 'STAGING_RBAC_LEDGER_REPAIRED',
    startedAt: input.startedAt,
    target: input.target,
    schemaFingerprintBefore: input.schemaFingerprintBefore,
    schemaFingerprintAfter: input.schemaFingerprintAfter,
    initialLedger: {
      completeUniqueRows: 156,
      missingMigrationCount: 4,
    },
    completedLedger: {
      completeUniqueRows: 160,
      normalDeployPreflightReady: true,
    },
    pinnedMigrations: STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.map(
      (migration) => ({
        checksumMode: 'exact-sha256',
        migrationName: migration.name,
        sha256: migration.sha256,
      }),
    ),
    note: 'Evidence contains no DATABASE_URL, credentials, tenant records, or role-assignment data.',
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return evidencePath;
}

async function main(): Promise<void> {
  const plan = createStagingRbacLedgerRepairPlan(process.argv.slice(2));
  if (plan.mode === 'PLAN_ONLY') {
    console.log(
      JSON.stringify(
        {
          ...plan,
          expectedInitialLedgerRows: 156,
          expectedRepositoryMigrations: 160,
          pinnedMigrations: STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS,
          note: 'Plan only: no database connection was opened and no migration, RBAC mapping, or ledger row was changed.',
        },
        null,
        2,
      ),
    );
    return;
  }

  // The source bytes are pinned and loaded before any database connection.
  const migrationDirectory = resolve(process.cwd(), 'prisma', 'migrations');
  const repositoryMigrations = readRepositoryMigrations(migrationDirectory);
  const pinnedSql = readPinnedStagingRbacMigrationSql(migrationDirectory);
  const target = assertQaWriteEnvironment(SCRIPT_NAME);
  const startedAt = new Date().toISOString();
  const pool = createStagingPool(target);
  let schemaFingerprintBefore: string | undefined;

  try {
    const client = await pool.connect();
    try {
      await verifyInitialRepairState(client, target, repositoryMigrations);
      schemaFingerprintBefore = await readQaSchemaFingerprint(
        createRawQueryClient(client),
      );
      await applyPinnedRbacSqlAndLedgerRows(
        client,
        target,
        repositoryMigrations,
        pinnedSql,
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  const schemaFingerprintAfter = await verifyCommittedRepairOnFreshConnection(
    target,
    repositoryMigrations,
  );
  if (!schemaFingerprintBefore) {
    throw new Error(
      'RBAC ledger repair did not capture its pre-transaction schema fingerprint.',
    );
  }
  const evidencePath = writeNonSensitiveRepairEvidence({
    completedAt: new Date().toISOString(),
    schemaFingerprintAfter,
    schemaFingerprintBefore,
    startedAt,
    target,
  });

  console.log(
    JSON.stringify(
      {
        status: 'STAGING_RBAC_LEDGER_REPAIRED',
        target,
        migrationCount: STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.length,
        evidencePath,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
