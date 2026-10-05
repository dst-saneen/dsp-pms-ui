import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  QA_STAGING_TARGET,
  assertNoCrossSchemaReferences,
  createCanonicalStagingDatabaseUrl,
  type QaWriteTarget,
} from '../assert-destructive-db-guard';
import {
  AppliedMigration,
  compareMigrationLineage,
  migrationChecksumVariants,
  type MigrationLineageComparison,
  type RepositoryMigration,
} from './migration-lineage';
import {
  findSchemaNeutralityViolations,
  IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS,
} from './schema-neutral-sql';

export type StagingMigrationDeployMode = 'PLAN_ONLY' | 'APPLY';

export interface StagingMigrationDeployPlan {
  mode: StagingMigrationDeployMode;
  target: QaWriteTarget;
  nodeExecutable: string;
  prismaCliPath: string;
  prismaArguments: string[];
}

export interface StagingMigrationLedgerRow extends AppliedMigration {
  finishedAt: Date | string | null;
  rolledBackAt: Date | string | null;
}

export interface StagingMigrationPreflight {
  lineage: MigrationLineageComparison;
  pendingMigrations: RepositoryMigration[];
}

const IMMUTABLE_LEGACY_MIGRATION_NAMES = new Set(
  Object.keys(IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS).map(
    (path) => path.split('/')[2],
  ),
);

const PROCESS_RUNTIME_ENVIRONMENT_KEYS = new Set([
  'APPDATA',
  'COMSPEC',
  'HOME',
  'LANG',
  'LC_ALL',
  'LOCALAPPDATA',
  'PATH',
  'PATHEXT',
  'PROGRAMDATA',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TZ',
  'USERPROFILE',
  'WINDIR',
]);

const DATABASE_TLS_ENVIRONMENT_KEYS = [
  'DATABASE_SSL_CA',
  'DATABASE_SSL_MODE',
] as const;

function displayList(values: readonly string[]): string {
  return values.join(', ');
}

/**
 * Prisma is a separate process. Do not inherit an application's broad env:
 * only platform runtime values, the canonical target identity, database URL,
 * and TLS settings are needed. In particular no PG* or PRISMA_* override can
 * survive into the migration process.
 */
export function createCanonicalPrismaChildEnvironment(
  parentEnv: NodeJS.ProcessEnv = process.env,
  target: QaWriteTarget,
): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(parentEnv)) {
    if (
      PROCESS_RUNTIME_ENVIRONMENT_KEYS.has(name.toUpperCase()) &&
      value !== undefined
    ) {
      childEnv[name] = value;
    }
  }

  const nodeEnv = parentEnv.NODE_ENV?.trim();
  if (nodeEnv) {
    childEnv.NODE_ENV = nodeEnv;
  }
  for (const name of DATABASE_TLS_ENVIRONMENT_KEYS) {
    const value = parentEnv[name]?.trim();
    if (value) {
      childEnv[name] = value;
    }
  }

  const databaseUrl = parentEnv.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Prisma migration deploy.');
  }
  childEnv.DATABASE_NAME = target.databaseName;
  childEnv.DATABASE_USER = target.databaseUser;
  childEnv.DATABASE_SCHEMA = target.databaseSchema;
  childEnv.DATABASE_URL = createCanonicalStagingDatabaseUrl(
    databaseUrl,
    target,
  );
  return childEnv;
}

/**
 * Prisma can otherwise attempt to replay missing historical migrations. A
 * structure-only staging baseline must already carry the complete immutable
 * history; only new, schema-neutral repository migrations can be pending.
 */
export function inspectStagingMigrationLedger(
  repositoryMigrations: readonly RepositoryMigration[],
  ledgerRows: readonly StagingMigrationLedgerRow[],
): StagingMigrationPreflight {
  const incompleteRows = ledgerRows.filter(
    (row) => row.finishedAt === null || row.rolledBackAt !== null,
  );
  if (incompleteRows.length > 0) {
    throw new Error(
      `Staging migration ledger contains incomplete or rolled-back migrations: ${displayList(
        incompleteRows.map((row) => row.migrationName).sort(),
      )}. Resolve the ledger before deployment.`,
    );
  }

  const lineage = compareMigrationLineage(
    [...repositoryMigrations],
    [...ledgerRows],
  );
  if (lineage.duplicateAppliedMigrations.length > 0) {
    throw new Error(
      `Staging migration ledger contains duplicate migrations: ${displayList(
        lineage.duplicateAppliedMigrations,
      )}.`,
    );
  }
  if (lineage.unexpectedMigrations.length > 0) {
    throw new Error(
      `Staging migration ledger contains migrations absent from this repository: ${displayList(
        lineage.unexpectedMigrations,
      )}.`,
    );
  }
  if (lineage.checksumMismatches.length > 0) {
    throw new Error(
      `Staging migration checksum mismatch: ${displayList(
        lineage.checksumMismatches.map((mismatch) => mismatch.migrationName),
      )}.`,
    );
  }

  const immutableReplay = lineage.missingMigrations.filter((migrationName) =>
    IMMUTABLE_LEGACY_MIGRATION_NAMES.has(migrationName),
  );
  if (immutableReplay.length > 0) {
    throw new Error(
      `Refusing to replay immutable legacy migrations into staging: ${displayList(
        immutableReplay,
      )}. Rebuild the staging baseline from the verified structure-only copy instead.`,
    );
  }

  const missingMigrationNames = new Set(lineage.missingMigrations);
  const firstMissingMigrationIndex = repositoryMigrations.findIndex(
    (migration) => missingMigrationNames.has(migration.name),
  );
  if (firstMissingMigrationIndex >= 0) {
    const outOfOrderAppliedMigration = repositoryMigrations
      .slice(firstMissingMigrationIndex)
      .find((migration) => !missingMigrationNames.has(migration.name));
    if (outOfOrderAppliedMigration) {
      throw new Error(
        `Staging migration ledger has a non-contiguous history before "${outOfOrderAppliedMigration.name}". Rebuild or repair the verified staging baseline instead of replaying a historical gap.`,
      );
    }
  }

  const repositoryByName = new Map(
    repositoryMigrations.map((migration) => [migration.name, migration]),
  );
  const pendingMigrations = lineage.missingMigrations.map((migrationName) => {
    const migration = repositoryByName.get(migrationName);
    if (!migration) {
      throw new Error(
        `Repository migration "${migrationName}" disappeared during staging preflight.`,
      );
    }
    return migration;
  });

  return { lineage, pendingMigrations };
}

/**
 * Pending migrations are checked again immediately before Prisma runs. The
 * deploy wrapper accepts only static, unqualified SQL; historical exceptions
 * are never pending because inspectStagingMigrationLedger rejects them.
 */
export function assertPendingMigrationsAreSchemaNeutral(
  pendingMigrations: readonly RepositoryMigration[],
  migrationDirectory: string,
): void {
  for (const migration of pendingMigrations) {
    if (IMMUTABLE_LEGACY_MIGRATION_NAMES.has(migration.name)) {
      throw new Error(
        `Refusing immutable legacy migration "${migration.name}" in the pending staging set.`,
      );
    }
    const migrationPath = resolve(
      migrationDirectory,
      migration.name,
      'migration.sql',
    );
    if (!existsSync(migrationPath)) {
      throw new Error(
        `Pending migration "${migration.name}" is missing migration.sql.`,
      );
    }
    const sql = readFileSync(migrationPath, 'utf8');
    if (
      migrationChecksumVariants(Buffer.from(sql, 'utf8')).exact !==
      migration.checksums.exact
    ) {
      throw new Error(
        `Pending migration "${migration.name}" changed after the staging ledger preflight. Re-run the deployment command.`,
      );
    }
    const violations = findSchemaNeutralityViolations(sql);
    if (violations.length > 0) {
      throw new Error(
        `Pending migration "${migration.name}" is not schema-neutral: ${displayList(
          violations,
        )}.`,
      );
    }
    assertNoCrossSchemaReferences(sql, QA_STAGING_TARGET.databaseSchema);
  }
}

/**
 * Builds the command plan without opening a database connection. Applying a
 * migration is intentionally opt-in so a copied command cannot write by
 * accident.
 */
export function createStagingMigrationDeployPlan(
  argumentsList: readonly string[],
  options: {
    cwd?: string;
    nodeExecutable?: string;
  } = {},
): StagingMigrationDeployPlan {
  if (
    argumentsList.length > 1 ||
    (argumentsList.length === 1 && argumentsList[0] !== '--apply')
  ) {
    throw new Error(
      'Usage: qa:staging:migrate:deploy [--apply]. No migration is applied without --apply.',
    );
  }

  const cwd = options.cwd ?? process.cwd();
  return {
    mode: argumentsList.includes('--apply') ? 'APPLY' : 'PLAN_ONLY',
    target: {
      databaseName: QA_STAGING_TARGET.databaseName,
      databaseUser: QA_STAGING_TARGET.databaseUser,
      databaseSchema: QA_STAGING_TARGET.databaseSchema,
      sentinelKey: QA_STAGING_TARGET.sentinelKey,
    },
    nodeExecutable: options.nodeExecutable ?? process.execPath,
    prismaCliPath: resolve(cwd, 'node_modules', 'prisma', 'build', 'index.js'),
    prismaArguments: ['migrate', 'deploy'],
  };
}

export function assertLocalPrismaCli(plan: StagingMigrationDeployPlan): void {
  if (!existsSync(plan.prismaCliPath)) {
    throw new Error(
      `Local Prisma CLI was not found at ${plan.prismaCliPath}. Install the locked backend dependencies before deploying migrations.`,
    );
  }
}
