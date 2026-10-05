import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertNoCrossSchemaReferences,
  QA_STAGING_TARGET,
} from '../assert-destructive-db-guard';
import {
  compareMigrationLineage,
  type AppliedMigration,
  type MigrationLineageComparison,
  type RepositoryMigration,
} from './migration-lineage';

/**
 * This is intentionally a closed list. It is not a general historical
 * migration repair mechanism and must not accept migration names from argv or
 * the environment.
 */
export const STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS = Object.freeze([
  Object.freeze({
    name: '20260918093000_hr_manager_projects_permissions',
    sha256: 'a64cb1d53e855d4d99ac382bc013b51e400afcc67ca47014747d03050830a4cc',
  }),
  Object.freeze({
    name: '20260918104500_hr_manager_finance_settings',
    sha256: '9e89cef2337838653b698b6f906c95c5afc2ad0b00d480b688055a74ce824168',
  }),
  Object.freeze({
    name: '20260918113000_employee_projects_permissions_cleanup',
    sha256: '59d4212d79ad32634902a9af72a421847088973b924064062c2872189ff3627e',
  }),
  Object.freeze({
    name: '20260918140000_owner_delivery_ops_permissions',
    sha256: 'f9ad224832010813091eb157d17e15c1de220f9aff49953dfa8ef66e6b386e6f',
  }),
] as const);

export const EXPECTED_STAGING_RBAC_LEDGER_BASELINE_ROWS = 156;
export const EXPECTED_STAGING_RBAC_REPOSITORY_MIGRATIONS = 160;
export const STAGING_RBAC_LEDGER_REPAIR_CONFIRMATION =
  '--confirm-rbac-ledger-repair';

export type StagingRbacLedgerRepairMigration =
  (typeof STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS)[number];
export type StagingRbacLedgerRepairMode = 'PLAN_ONLY' | 'APPLY';

export interface StagingRbacLedgerRepairPlan {
  mode: StagingRbacLedgerRepairMode;
  target: {
    databaseName: string;
    databaseSchema: string;
    databaseUser: string;
    sentinelKey: string;
  };
}

export interface StagingRbacLedgerRow extends AppliedMigration {
  appliedStepsCount?: number | null;
  finishedAt: Date | string | null;
  id?: string;
  logs?: string | null;
  rolledBackAt: Date | string | null;
  startedAt?: Date | string | null;
}

export type PinnedRbacMigrationSql = StagingRbacLedgerRepairMigration & {
  sql: string;
};

export interface StagingRbacLedgerRepairPreflight {
  lineage: MigrationLineageComparison;
  pendingMigrations: readonly StagingRbacLedgerRepairMigration[];
}

export interface RbacReferenceRow {
  code: string;
  kind: 'permission' | 'role';
  rowCount: number;
}

export interface RbacPermissionMappingRow {
  actualCount: number;
  expectedCount: number;
  permissionCode: string;
  roleCode: string;
}

const REQUIRED_ROLE_CODES = [
  'HR_MANAGER',
  'EMPLOYEE',
  'ORGANIZATION_OWNER',
  'COMPANY_ADMINISTRATOR',
] as const;

const REQUIRED_PERMISSION_CODES = [
  'projects.projects.read',
  'projects.projects.manage',
  'projects.tasks.work',
  'projects.timesheets.submit',
  'projects.timesheets.approve',
  'finance.settings.manage',
  'platform.delivery.read',
  'platform.delivery.retry',
] as const;

const EXPECTED_RBAC_PERMISSION_MAPPINGS = [
  {
    actualCount: 1,
    permissionCode: 'projects.projects.read',
    roleCode: 'HR_MANAGER',
  },
  {
    actualCount: 1,
    permissionCode: 'projects.projects.manage',
    roleCode: 'HR_MANAGER',
  },
  {
    actualCount: 1,
    permissionCode: 'projects.tasks.work',
    roleCode: 'HR_MANAGER',
  },
  {
    actualCount: 1,
    permissionCode: 'projects.timesheets.submit',
    roleCode: 'HR_MANAGER',
  },
  {
    actualCount: 1,
    permissionCode: 'projects.timesheets.approve',
    roleCode: 'HR_MANAGER',
  },
  {
    actualCount: 1,
    permissionCode: 'finance.settings.manage',
    roleCode: 'HR_MANAGER',
  },
  {
    actualCount: 0,
    permissionCode: 'projects.projects.read',
    roleCode: 'EMPLOYEE',
  },
  {
    actualCount: 0,
    permissionCode: 'projects.projects.manage',
    roleCode: 'EMPLOYEE',
  },
  {
    actualCount: 0,
    permissionCode: 'projects.timesheets.approve',
    roleCode: 'EMPLOYEE',
  },
  {
    actualCount: 1,
    permissionCode: 'platform.delivery.read',
    roleCode: 'ORGANIZATION_OWNER',
  },
  {
    actualCount: 1,
    permissionCode: 'platform.delivery.retry',
    roleCode: 'ORGANIZATION_OWNER',
  },
  {
    actualCount: 1,
    permissionCode: 'platform.delivery.read',
    roleCode: 'COMPANY_ADMINISTRATOR',
  },
  {
    actualCount: 1,
    permissionCode: 'platform.delivery.retry',
    roleCode: 'COMPANY_ADMINISTRATOR',
  },
] as const;

/**
 * Fixed source-of-truth reference check. The list cannot be supplied by a
 * caller, which prevents this maintenance tool from becoming a generic RBAC
 * writer.
 */
export const STAGING_RBAC_REFERENCE_VALIDATION_SQL = `
SELECT 'role'::text AS "kind",
       "code",
       COUNT(*)::int AS "rowCount"
  FROM "roles"
 WHERE "code" IN (
   'HR_MANAGER',
   'EMPLOYEE',
   'ORGANIZATION_OWNER',
   'COMPANY_ADMINISTRATOR'
 )
 GROUP BY "code"
UNION ALL
SELECT 'permission'::text AS "kind",
       "code",
       COUNT(*)::int AS "rowCount"
  FROM "permissions"
 WHERE "code" IN (
   'projects.projects.read',
   'projects.projects.manage',
   'projects.tasks.work',
   'projects.timesheets.submit',
   'projects.timesheets.approve',
   'finance.settings.manage',
   'platform.delivery.read',
   'platform.delivery.retry'
 )
 GROUP BY "code"
ORDER BY "kind", "code"`;

/**
 * This is a proof query, not a parameterised permission-management API. It
 * checks exactly the ten grants and three removals represented by the four
 * pinned migration files.
 */
export const STAGING_RBAC_PERMISSION_MAPPING_VALIDATION_SQL = `
WITH expected("roleCode", "permissionCode", "expectedCount") AS (
  VALUES
    ('HR_MANAGER', 'projects.projects.read', 1),
    ('HR_MANAGER', 'projects.projects.manage', 1),
    ('HR_MANAGER', 'projects.tasks.work', 1),
    ('HR_MANAGER', 'projects.timesheets.submit', 1),
    ('HR_MANAGER', 'projects.timesheets.approve', 1),
    ('HR_MANAGER', 'finance.settings.manage', 1),
    ('EMPLOYEE', 'projects.projects.read', 0),
    ('EMPLOYEE', 'projects.projects.manage', 0),
    ('EMPLOYEE', 'projects.timesheets.approve', 0),
    ('ORGANIZATION_OWNER', 'platform.delivery.read', 1),
    ('ORGANIZATION_OWNER', 'platform.delivery.retry', 1),
    ('COMPANY_ADMINISTRATOR', 'platform.delivery.read', 1),
    ('COMPANY_ADMINISTRATOR', 'platform.delivery.retry', 1)
)
SELECT expected."roleCode",
       expected."permissionCode",
       expected."expectedCount"::int AS "expectedCount",
       COUNT("role_permissions"."id")::int AS "actualCount"
  FROM expected
  JOIN "roles"
    ON "roles"."code" = expected."roleCode"
  JOIN "permissions"
    ON "permissions"."code" = expected."permissionCode"
  LEFT JOIN "role_permissions"
    ON "role_permissions"."roleId" = "roles"."id"
   AND "role_permissions"."permissionId" = "permissions"."id"
 GROUP BY expected."roleCode",
          expected."permissionCode",
          expected."expectedCount"
 ORDER BY expected."roleCode", expected."permissionCode"`;

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function namesMatch(
  actualNames: readonly string[],
  expectedNames: readonly string[],
): boolean {
  const sortedActual = [...actualNames].sort();
  const sortedExpected = [...expectedNames].sort();
  return (
    sortedActual.length === sortedExpected.length &&
    sortedActual.every((name, index) => name === sortedExpected[index])
  );
}

function describeNames(names: readonly string[]): string {
  return [...names].sort().join(', ');
}

/**
 * The repository count is pinned alongside the four source hashes. If the
 * branch changes, an operator must review a new repair tool rather than use a
 * historical-gap exception against a different lineage.
 */
export function assertPinnedStagingRbacRepairRepository(
  repositoryMigrations: readonly RepositoryMigration[],
): void {
  if (
    repositoryMigrations.length !== EXPECTED_STAGING_RBAC_REPOSITORY_MIGRATIONS
  ) {
    throw new Error(
      `RBAC ledger repair requires exactly ${String(
        EXPECTED_STAGING_RBAC_REPOSITORY_MIGRATIONS,
      )} repository migrations; found ${String(repositoryMigrations.length)}.`,
    );
  }

  const repositoryByName = new Map<string, RepositoryMigration>();
  for (const migration of repositoryMigrations) {
    if (repositoryByName.has(migration.name)) {
      throw new Error(
        `RBAC ledger repair found duplicate repository migration "${migration.name}".`,
      );
    }
    repositoryByName.set(migration.name, migration);
  }

  for (const pinnedMigration of STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS) {
    const repositoryMigration = repositoryByName.get(pinnedMigration.name);
    if (!repositoryMigration) {
      throw new Error(
        `RBAC ledger repair requires pinned migration "${pinnedMigration.name}" in this repository.`,
      );
    }
    if (repositoryMigration.checksums.exact !== pinnedMigration.sha256) {
      throw new Error(
        `RBAC ledger repair source hash mismatch for "${pinnedMigration.name}".`,
      );
    }
  }
}

function assertCompleteUniqueLedgerRows(
  ledgerRows: readonly StagingRbacLedgerRow[],
  expectedRowCount: number,
): void {
  if (ledgerRows.length !== expectedRowCount) {
    throw new Error(
      `RBAC ledger repair requires exactly ${String(
        expectedRowCount,
      )} complete ledger rows; found ${String(ledgerRows.length)}.`,
    );
  }

  const incompleteRows = ledgerRows.filter(
    (row) => row.finishedAt === null || row.rolledBackAt !== null,
  );
  if (incompleteRows.length > 0) {
    throw new Error(
      `RBAC ledger repair refuses incomplete or rolled-back rows: ${describeNames(
        incompleteRows.map((row) => row.migrationName),
      )}.`,
    );
  }

  const names = ledgerRows.map((row) => row.migrationName);
  if (new Set(names).size !== names.length) {
    throw new Error(
      'RBAC ledger repair requires unique migration ledger rows.',
    );
  }
}

function assertLineageHasOnlyExpectedGap(
  repositoryMigrations: readonly RepositoryMigration[],
  ledgerRows: readonly StagingRbacLedgerRow[],
  expectedMissing: readonly string[],
): MigrationLineageComparison {
  const lineage = compareMigrationLineage(
    [...repositoryMigrations],
    [...ledgerRows],
  );
  if (lineage.duplicateAppliedMigrations.length > 0) {
    throw new Error(
      `RBAC ledger repair found duplicate applied migrations: ${describeNames(
        lineage.duplicateAppliedMigrations,
      )}.`,
    );
  }
  if (lineage.unexpectedMigrations.length > 0) {
    throw new Error(
      `RBAC ledger repair found migrations absent from this repository: ${describeNames(
        lineage.unexpectedMigrations,
      )}.`,
    );
  }
  if (lineage.checksumMismatches.length > 0) {
    throw new Error(
      `RBAC ledger repair found checksum mismatches: ${describeNames(
        lineage.checksumMismatches.map((mismatch) => mismatch.migrationName),
      )}.`,
    );
  }

  if (!namesMatch(lineage.missingMigrations, expectedMissing)) {
    throw new Error(
      `RBAC ledger repair requires exactly this missing migration set: ${describeNames(
        expectedMissing,
      )}. Found: ${describeNames(lineage.missingMigrations)}.`,
    );
  }

  for (const pinnedMigration of STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS) {
    const applied = ledgerRows.find(
      (row) => row.migrationName === pinnedMigration.name,
    );
    if (applied && applied.checksum !== pinnedMigration.sha256) {
      throw new Error(
        `RBAC ledger repair requires the exact pinned checksum for "${pinnedMigration.name}" when present in the ledger.`,
      );
    }
  }

  return lineage;
}

function normalizedTimestamp(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) {
    throw new Error(
      'RBAC ledger repair requires Prisma migration rows to have started_at and finished_at timestamps.',
    );
  }
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      'RBAC ledger repair found an invalid Prisma migration timestamp.',
    );
  }
  return timestamp.toISOString();
}

/**
 * Prisma 7.9.1 successful-deploy rows observed in the staging ledger use a
 * UUID v4, an exact source checksum, NULL logs/rolled_back_at, one shared
 * started/finished timestamp, and applied_steps_count = 1. The atomic repair
 * writes only these four rows to that successful-deploy shape.
 */
function assertPinnedSuccessfulDeployRowShape(
  ledgerRows: readonly StagingRbacLedgerRow[],
): void {
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const pinnedMigration of STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS) {
    const row = ledgerRows.find(
      (candidate) => candidate.migrationName === pinnedMigration.name,
    );
    if (!row) {
      throw new Error(
        `RBAC ledger repair post-check is missing "${pinnedMigration.name}".`,
      );
    }
    if (!row.id || !uuidV4.test(row.id)) {
      throw new Error(
        `RBAC ledger repair requires a Prisma-compatible UUID v4 for "${pinnedMigration.name}".`,
      );
    }
    if (row.checksum !== pinnedMigration.sha256) {
      throw new Error(
        `RBAC ledger repair requires the exact pinned checksum for "${pinnedMigration.name}".`,
      );
    }
    if (row.logs !== null || row.appliedStepsCount !== 1) {
      throw new Error(
        `RBAC ledger repair requires successful-deploy metadata for "${pinnedMigration.name}".`,
      );
    }
    if (
      normalizedTimestamp(row.startedAt) !== normalizedTimestamp(row.finishedAt)
    ) {
      throw new Error(
        `RBAC ledger repair requires matching started_at and finished_at timestamps for "${pinnedMigration.name}".`,
      );
    }
  }
}

/**
 * Common exact-lineage verifier for the two states this tool permits: the
 * original 156-row gap and the atomically repaired 160-row ledger. It is not
 * exported as a generic migration repair API.
 */
function inspectPinnedStagingRbacLedgerRepairState(
  repositoryMigrations: readonly RepositoryMigration[],
  ledgerRows: readonly StagingRbacLedgerRow[],
  expectedRowCount: number,
  expectedMissing: readonly string[],
): StagingRbacLedgerRepairPreflight {
  assertPinnedStagingRbacRepairRepository(repositoryMigrations);
  assertCompleteUniqueLedgerRows(ledgerRows, expectedRowCount);
  const lineage = assertLineageHasOnlyExpectedGap(
    repositoryMigrations,
    ledgerRows,
    expectedMissing,
  );
  return {
    lineage,
    pendingMigrations: STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.filter(
      (migration) => expectedMissing.includes(migration.name),
    ),
  };
}

/**
 * The only apply entry point: exactly 156 complete, unique ledger rows and
 * exactly the four pinned migrations missing.
 */
export function inspectInitialStagingRbacLedgerRepair(
  repositoryMigrations: readonly RepositoryMigration[],
  ledgerRows: readonly StagingRbacLedgerRow[],
): StagingRbacLedgerRepairPreflight {
  return inspectPinnedStagingRbacLedgerRepairState(
    repositoryMigrations,
    ledgerRows,
    EXPECTED_STAGING_RBAC_LEDGER_BASELINE_ROWS,
    STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.map((migration) => migration.name),
  );
}

/**
 * Post-commit proof only. Because the SQL effects and ledger rows are written
 * in one transaction, a partial 157-159-row prefix is never a valid state for
 * this tool and must be investigated instead of resumed.
 */
export function inspectCompletedStagingRbacLedgerRepair(
  repositoryMigrations: readonly RepositoryMigration[],
  ledgerRows: readonly StagingRbacLedgerRow[],
): StagingRbacLedgerRepairPreflight {
  const preflight = inspectPinnedStagingRbacLedgerRepairState(
    repositoryMigrations,
    ledgerRows,
    EXPECTED_STAGING_RBAC_LEDGER_BASELINE_ROWS +
      STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.length,
    [],
  );
  assertPinnedSuccessfulDeployRowShape(ledgerRows);
  return preflight;
}

/**
 * Reads the exact SQL bytes that will be used for the transaction. The source
 * is still static: every path and SHA-256 value is hard-coded above, and a
 * changed byte fails closed before any database connection is opened.
 */
export function readPinnedStagingRbacMigrationSql(
  migrationDirectory: string,
): PinnedRbacMigrationSql[] {
  return STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.map((migration) => {
    const migrationPath = resolve(
      migrationDirectory,
      migration.name,
      'migration.sql',
    );
    if (!existsSync(migrationPath)) {
      throw new Error(
        `RBAC ledger repair source file is missing for "${migration.name}".`,
      );
    }
    const content = readFileSync(migrationPath);
    if (sha256(content) !== migration.sha256) {
      throw new Error(
        `RBAC ledger repair source hash mismatch for "${migration.name}".`,
      );
    }
    const sql = content.toString('utf8');
    assertNoCrossSchemaReferences(sql, QA_STAGING_TARGET.databaseSchema);
    return { ...migration, sql };
  });
}

function expectedReferenceKeys(): string[] {
  return [
    ...REQUIRED_ROLE_CODES.map((code) => `role:${code}`),
    ...REQUIRED_PERMISSION_CODES.map((code) => `permission:${code}`),
  ];
}

/**
 * Requires each static role and permission lookup used by the source SQL to
 * resolve exactly once. This prevents the JOIN-based migration SQL from
 * silently applying zero or multiply-expanded mappings.
 */
export function assertPinnedStagingRbacReferences(
  rows: readonly RbacReferenceRow[],
): void {
  const expectedKeys = expectedReferenceKeys();
  const actual = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.kind}:${row.code}`;
    if (actual.has(key)) {
      throw new Error(
        `RBAC ledger repair reference check returned duplicate ${key}.`,
      );
    }
    actual.set(key, row.rowCount);
  }

  if (!namesMatch([...actual.keys()], expectedKeys)) {
    throw new Error(
      `RBAC ledger repair reference set differs from the fixed source requirements. Expected: ${describeNames(
        expectedKeys,
      )}. Found: ${describeNames([...actual.keys()])}.`,
    );
  }
  for (const key of expectedKeys) {
    if (actual.get(key) !== 1) {
      throw new Error(
        `RBAC ledger repair requires exactly one ${key} reference row.`,
      );
    }
  }
}

function expectedMappingKey(roleCode: string, permissionCode: string): string {
  return `${roleCode}:${permissionCode}`;
}

/**
 * Validates query shape independently of whether the migration effects have
 * been applied yet. A pre-apply mismatch is permitted; an unrecognised row or
 * duplicate result is not.
 */
export function assertPinnedStagingRbacMappingRows(
  rows: readonly RbacPermissionMappingRow[],
): void {
  const expected = new Map(
    EXPECTED_RBAC_PERMISSION_MAPPINGS.map((mapping) => [
      expectedMappingKey(mapping.roleCode, mapping.permissionCode),
      mapping.actualCount,
    ]),
  );
  const actual = new Map<string, RbacPermissionMappingRow>();
  for (const row of rows) {
    const key = expectedMappingKey(row.roleCode, row.permissionCode);
    if (actual.has(key)) {
      throw new Error(
        `RBAC ledger repair mapping check returned duplicate ${key}.`,
      );
    }
    if (row.expectedCount !== expected.get(key)) {
      throw new Error(
        `RBAC ledger repair mapping check returned an unexpected row ${key}.`,
      );
    }
    actual.set(key, row);
  }
  if (!namesMatch([...actual.keys()], [...expected.keys()])) {
    throw new Error(
      'RBAC ledger repair mapping check did not return the fixed mapping set.',
    );
  }
}

export function stagingRbacMappingsMatchExpected(
  rows: readonly RbacPermissionMappingRow[],
): boolean {
  assertPinnedStagingRbacMappingRows(rows);
  return rows.every((row) => row.actualCount === row.expectedCount);
}

export function assertPinnedStagingRbacMappingsMatchExpected(
  rows: readonly RbacPermissionMappingRow[],
): void {
  if (!stagingRbacMappingsMatchExpected(rows)) {
    const mismatches = rows
      .filter((row) => row.actualCount !== row.expectedCount)
      .map(
        (row) =>
          `${row.roleCode}:${row.permissionCode} expected ${String(
            row.expectedCount,
          )}, found ${String(row.actualCount)}`,
      );
    throw new Error(
      `RBAC ledger repair effects do not match the pinned migration outcome: ${mismatches.join(
        '; ',
      )}.`,
    );
  }
}

export function createStagingRbacLedgerRepairPlan(
  argumentsList: readonly string[],
): StagingRbacLedgerRepairPlan {
  const isPlanOnly = argumentsList.length === 0;
  const isApply =
    argumentsList.length === 2 &&
    argumentsList.includes('--apply') &&
    argumentsList.includes(STAGING_RBAC_LEDGER_REPAIR_CONFIRMATION);

  if (!isPlanOnly && !isApply) {
    throw new Error(
      `Usage: qa:staging:repair-rbac-ledger [--apply ${STAGING_RBAC_LEDGER_REPAIR_CONFIRMATION}]. No database connection or write occurs without both exact apply arguments.`,
    );
  }

  return {
    mode: isApply ? 'APPLY' : 'PLAN_ONLY',
    target: {
      databaseName: QA_STAGING_TARGET.databaseName,
      databaseSchema: QA_STAGING_TARGET.databaseSchema,
      databaseUser: QA_STAGING_TARGET.databaseUser,
      sentinelKey: QA_STAGING_TARGET.sentinelKey,
    },
  };
}
