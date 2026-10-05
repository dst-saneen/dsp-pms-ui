import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Pool, type PoolClient } from 'pg';

import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  createCanonicalStagingDatabaseUrl,
  requiredEnv,
  type QaWriteTarget,
  type RawQueryClient,
} from '../assert-destructive-db-guard';
import { readRepositoryMigrations } from './migration-lineage';
import {
  assertLocalPrismaCli,
  assertPendingMigrationsAreSchemaNeutral,
  createCanonicalPrismaChildEnvironment,
  createStagingMigrationDeployPlan,
  inspectStagingMigrationLedger,
  type StagingMigrationLedgerRow,
  type StagingMigrationPreflight,
} from './staging-migration-deploy-plan';

const SCRIPT_NAME = 'qa:staging:migrate:deploy';

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
      '-c application_name=dsp_qa_staging_migration_deploy',
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

/**
 * Opens a fresh connection for each guard. Prisma runs in a separate process,
 * so neither verification can accidentally reuse that process's connection.
 */
type LedgerRelationRow = {
  migrationLedgerSchema: string | null;
};

async function readStagingMigrationLedger(
  client: PoolClient,
  target: QaWriteTarget,
): Promise<StagingMigrationLedgerRow[]> {
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

  const result = await client.query<StagingMigrationLedgerRow>(
    `SELECT migration_name AS "migrationName",
            checksum,
            finished_at AS "finishedAt",
            rolled_back_at AS "rolledBackAt"
       FROM "_prisma_migrations"
      ORDER BY migration_name, started_at, id`,
  );
  return result.rows;
}

export async function verifyStagingMigrationTarget(
  target: QaWriteTarget,
): Promise<StagingMigrationPreflight> {
  const pool = createStagingPool(target);
  try {
    const client = await pool.connect();
    try {
      await assertQaStagingSentinel(
        createRawQueryClient(client),
        SCRIPT_NAME,
        target,
      );
      const ledgerRows = await readStagingMigrationLedger(client, target);
      const migrationDirectory = resolve(process.cwd(), 'prisma', 'migrations');
      const preflight = inspectStagingMigrationLedger(
        readRepositoryMigrations(migrationDirectory),
        ledgerRows,
      );
      assertPendingMigrationsAreSchemaNeutral(
        preflight.pendingMigrations,
        migrationDirectory,
      );
      return preflight;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function runLocalPrismaDeploy(
  nodeExecutable: string,
  prismaCliPath: string,
  prismaArguments: readonly string[],
  environment: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(
    nodeExecutable,
    [prismaCliPath, ...prismaArguments],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Local Prisma migrate deploy exited with code ${String(result.status)}. The staging target will still be re-verified.`,
    );
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function main(): Promise<void> {
  const plan = createStagingMigrationDeployPlan(process.argv.slice(2));
  if (plan.mode === 'PLAN_ONLY') {
    console.log(
      JSON.stringify(
        {
          ...plan,
          note: 'No database connection was opened and no migration was applied. Re-run with --apply only during the approved staging window.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const target = assertQaWriteEnvironment(SCRIPT_NAME);
  assertLocalPrismaCli(plan);

  // This check completes and its connection is closed before Prisma can write.
  // It verifies the exact effective search_path/sentinel, reads the staging
  // ledger, rejects legacy replay or lineage drift, and statically proves every
  // pending migration is schema-neutral.
  const preflight = await verifyStagingMigrationTarget(target);
  const childEnvironment = createCanonicalPrismaChildEnvironment(
    process.env,
    target,
  );
  let deploymentError: Error | undefined;
  try {
    runLocalPrismaDeploy(
      plan.nodeExecutable,
      plan.prismaCliPath,
      plan.prismaArguments,
      childEnvironment,
    );
  } catch (error) {
    deploymentError = asError(error);
  }

  // A new connection proves the Prisma process did not change targets or lose
  // the sentinel while applying the migrations. It also runs after a failed
  // Prisma command, so an operator never loses the target evidence.
  let postDeployVerificationError: Error | undefined;
  try {
    const postDeployPreflight = await verifyStagingMigrationTarget(target);
    if (postDeployPreflight.pendingMigrations.length > 0) {
      throw new Error(
        `Local Prisma migrate deploy completed but ${String(
          postDeployPreflight.pendingMigrations.length,
        )} repository migrations remain pending.`,
      );
    }
  } catch (error) {
    postDeployVerificationError = asError(error);
  }
  if (deploymentError && postDeployVerificationError) {
    throw new AggregateError(
      [deploymentError, postDeployVerificationError],
      'Prisma migration deploy failed and the post-deploy staging target check also failed.',
    );
  }
  if (deploymentError) {
    throw deploymentError;
  }
  if (postDeployVerificationError) {
    throw postDeployVerificationError;
  }

  console.log(
    JSON.stringify(
      {
        status: 'STAGING_MIGRATIONS_DEPLOYED',
        target,
        appliedMigrationCount: preflight.pendingMigrations.length,
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
