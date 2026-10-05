import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QA_STAGING_TARGET } from '../../scripts/assert-destructive-db-guard';
import {
  migrationChecksumVariants,
  type RepositoryMigration,
} from '../../scripts/qa/migration-lineage';
import {
  assertPinnedStagingRbacMappingRows,
  assertPinnedStagingRbacMappingsMatchExpected,
  assertPinnedStagingRbacReferences,
  createStagingRbacLedgerRepairPlan,
  inspectCompletedStagingRbacLedgerRepair,
  inspectInitialStagingRbacLedgerRepair,
  readPinnedStagingRbacMigrationSql,
  stagingRbacMappingsMatchExpected,
  STAGING_RBAC_LEDGER_REPAIR_CONFIRMATION,
  STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS,
  type RbacPermissionMappingRow,
  type RbacReferenceRow,
  type StagingRbacLedgerRow,
} from '../../scripts/qa/staging-rbac-ledger-repair-plan';

function repositoryMigration(name: string): RepositoryMigration {
  return {
    name,
    checksums: migrationChecksumVariants(Buffer.from(`-- ${name}\n`, 'utf8')),
  };
}

function pinnedRepositoryMigration(
  migration: (typeof STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS)[number],
): RepositoryMigration {
  return {
    name: migration.name,
    checksums: {
      crlf: migration.sha256,
      exact: migration.sha256,
      lf: migration.sha256,
    },
  };
}

function repositoryFixture(): RepositoryMigration[] {
  const baseline = Array.from({ length: 156 }, (_, index) =>
    repositoryMigration(
      `20250101${String(index).padStart(6, '0')}_baseline_${String(index)}`,
    ),
  );
  return [
    ...baseline,
    ...STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.map(pinnedRepositoryMigration),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function appliedLedgerRow(
  migration: RepositoryMigration,
  overrides: Partial<StagingRbacLedgerRow> = {},
): StagingRbacLedgerRow {
  return {
    checksum: migration.checksums.exact,
    finishedAt: new Date('2026-09-18T00:00:00.000Z'),
    migrationName: migration.name,
    rolledBackAt: null,
    ...overrides,
  };
}

function initialLedgerFixture(): StagingRbacLedgerRow[] {
  const pinnedNames = new Set<string>(
    STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.map((migration) => migration.name),
  );
  return repositoryFixture()
    .filter((migration) => !pinnedNames.has(migration.name))
    .map((migration) => appliedLedgerRow(migration));
}

function completedLedgerFixture(): StagingRbacLedgerRow[] {
  const timestamp = new Date('2026-09-19T09:00:00.000Z');
  return repositoryFixture().map((migration, index) => {
    const pinnedIndex = STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.findIndex(
      (pinned) => pinned.name === migration.name,
    );
    if (pinnedIndex < 0) {
      return appliedLedgerRow(migration);
    }
    return appliedLedgerRow(migration, {
      appliedStepsCount: 1,
      finishedAt: timestamp,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      logs: null,
      startedAt: timestamp,
    });
  });
}

function referenceRows(): RbacReferenceRow[] {
  return [
    { code: 'HR_MANAGER', kind: 'role', rowCount: 1 },
    { code: 'EMPLOYEE', kind: 'role', rowCount: 1 },
    { code: 'ORGANIZATION_OWNER', kind: 'role', rowCount: 1 },
    { code: 'COMPANY_ADMINISTRATOR', kind: 'role', rowCount: 1 },
    { code: 'projects.projects.read', kind: 'permission', rowCount: 1 },
    { code: 'projects.projects.manage', kind: 'permission', rowCount: 1 },
    { code: 'projects.tasks.work', kind: 'permission', rowCount: 1 },
    { code: 'projects.timesheets.submit', kind: 'permission', rowCount: 1 },
    { code: 'projects.timesheets.approve', kind: 'permission', rowCount: 1 },
    { code: 'finance.settings.manage', kind: 'permission', rowCount: 1 },
    { code: 'platform.delivery.read', kind: 'permission', rowCount: 1 },
    { code: 'platform.delivery.retry', kind: 'permission', rowCount: 1 },
  ];
}

function mappingRows(): RbacPermissionMappingRow[] {
  return [
    ['HR_MANAGER', 'projects.projects.read', 1],
    ['HR_MANAGER', 'projects.projects.manage', 1],
    ['HR_MANAGER', 'projects.tasks.work', 1],
    ['HR_MANAGER', 'projects.timesheets.submit', 1],
    ['HR_MANAGER', 'projects.timesheets.approve', 1],
    ['HR_MANAGER', 'finance.settings.manage', 1],
    ['EMPLOYEE', 'projects.projects.read', 0],
    ['EMPLOYEE', 'projects.projects.manage', 0],
    ['EMPLOYEE', 'projects.timesheets.approve', 0],
    ['ORGANIZATION_OWNER', 'platform.delivery.read', 1],
    ['ORGANIZATION_OWNER', 'platform.delivery.retry', 1],
    ['COMPANY_ADMINISTRATOR', 'platform.delivery.read', 1],
    ['COMPANY_ADMINISTRATOR', 'platform.delivery.retry', 1],
  ].map(([roleCode, permissionCode, expectedCount]) => ({
    actualCount: expectedCount,
    expectedCount,
    permissionCode,
    roleCode,
  })) as RbacPermissionMappingRow[];
}

describe('staging RBAC ledger repair', () => {
  it('is plan-only by default and accepts only the operation-specific confirmation', () => {
    expect(createStagingRbacLedgerRepairPlan([])).toEqual({
      mode: 'PLAN_ONLY',
      target: {
        databaseName: QA_STAGING_TARGET.databaseName,
        databaseSchema: QA_STAGING_TARGET.databaseSchema,
        databaseUser: QA_STAGING_TARGET.databaseUser,
        sentinelKey: QA_STAGING_TARGET.sentinelKey,
      },
    });
    expect(
      createStagingRbacLedgerRepairPlan([
        '--apply',
        STAGING_RBAC_LEDGER_REPAIR_CONFIRMATION,
      ]).mode,
    ).toBe('APPLY');
    expect(() => createStagingRbacLedgerRepairPlan(['--apply'])).toThrow(
      'No database connection or write occurs without both exact apply arguments',
    );
    expect(() =>
      createStagingRbacLedgerRepairPlan([
        '--apply',
        '--confirm-rbac-ledger-repair',
        '--another-override',
      ]),
    ).toThrow('Usage: qa:staging:repair-rbac-ledger');
  });

  it('accepts only the exact 156-row initial lineage with the four pinned gaps', () => {
    const preflight = inspectInitialStagingRbacLedgerRepair(
      repositoryFixture(),
      initialLedgerFixture(),
    );

    expect(preflight.pendingMigrations).toEqual(
      STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS,
    );
    expect(preflight.lineage.repositoryMigrationCount).toBe(160);
    expect(preflight.lineage.uniqueAppliedMigrationCount).toBe(156);
  });

  it('fails closed for a wrong missing set, duplicate row, incomplete row, or checksum drift', () => {
    const repository = repositoryFixture();
    const initial = initialLedgerFixture();
    const firstPinned = pinnedRepositoryMigration(
      STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS[0],
    );
    const wrongMissingSet = [
      ...initial.slice(1),
      appliedLedgerRow(firstPinned),
    ];
    expect(() =>
      inspectInitialStagingRbacLedgerRepair(repository, wrongMissingSet),
    ).toThrow('requires exactly this missing migration set');

    const duplicate = [...initial];
    duplicate[1] = {
      ...duplicate[1],
      migrationName: duplicate[0].migrationName,
    };
    expect(() =>
      inspectInitialStagingRbacLedgerRepair(repository, duplicate),
    ).toThrow('requires unique migration ledger rows');

    const incomplete = [...initial];
    incomplete[0] = { ...incomplete[0], finishedAt: null };
    expect(() =>
      inspectInitialStagingRbacLedgerRepair(repository, incomplete),
    ).toThrow('incomplete or rolled-back rows');

    const drifted = [...initial];
    drifted[0] = { ...drifted[0], checksum: 'not-a-migration-checksum' };
    expect(() =>
      inspectInitialStagingRbacLedgerRepair(repository, drifted),
    ).toThrow('checksum mismatches');
  });

  it.each([1, 2, 3])(
    'fails closed for an unsupported partial %i-row ledger state',
    (resolvedPinnedMigrationCount) => {
      const repository = repositoryFixture();
      const partialLedger = [
        ...initialLedgerFixture(),
        ...STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.slice(
          0,
          resolvedPinnedMigrationCount,
        )
          .map(pinnedRepositoryMigration)
          .map((migration) => appliedLedgerRow(migration)),
      ];

      expect(() =>
        inspectInitialStagingRbacLedgerRepair(repository, partialLedger),
      ).toThrow('requires exactly 156 complete ledger rows');
      expect(() =>
        inspectCompletedStagingRbacLedgerRepair(repository, partialLedger),
      ).toThrow('requires exactly 160 complete ledger rows');
    },
  );

  it('requires exact source hashes and a complete successful-deploy row shape after commit', () => {
    const repository = repositoryFixture();
    const completed = completedLedgerFixture();

    expect(() =>
      inspectCompletedStagingRbacLedgerRepair(repository, completed),
    ).not.toThrow();
    expect(() =>
      inspectInitialStagingRbacLedgerRepair(repository, completed),
    ).toThrow('requires exactly 156 complete ledger rows');

    const badMetadata = [...completed];
    const targetIndex = badMetadata.findIndex(
      (row) =>
        row.migrationName === STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS[0].name,
    );
    badMetadata[targetIndex] = {
      ...badMetadata[targetIndex],
      appliedStepsCount: 0,
      logs: '',
    };
    expect(() =>
      inspectCompletedStagingRbacLedgerRepair(repository, badMetadata),
    ).toThrow('successful-deploy metadata');

    const badTimestamp = [...completed];
    badTimestamp[targetIndex] = {
      ...badTimestamp[targetIndex],
      startedAt: new Date('2026-09-19T09:00:01.000Z'),
    };
    expect(() =>
      inspectCompletedStagingRbacLedgerRepair(repository, badTimestamp),
    ).toThrow('matching started_at and finished_at timestamps');

    const badUuid = [...completed];
    badUuid[targetIndex] = {
      ...badUuid[targetIndex],
      id: '00000000-0000-1000-8000-000000000000',
    };
    expect(() =>
      inspectCompletedStagingRbacLedgerRepair(repository, badUuid),
    ).toThrow('Prisma-compatible UUID v4');

    const wrongPinnedHash = repository.map((migration) =>
      migration.name === STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS[0].name
        ? {
            ...migration,
            checksums: { ...migration.checksums, exact: 'wrong-pinned-hash' },
          }
        : migration,
    );
    expect(() =>
      inspectInitialStagingRbacLedgerRepair(
        wrongPinnedHash,
        initialLedgerFixture(),
      ),
    ).toThrow('source hash mismatch');
  });

  it('reads only the four checked-in static source files when their hashes match', () => {
    const sql = readPinnedStagingRbacMigrationSql(
      resolve(process.cwd(), 'prisma', 'migrations'),
    );
    expect(sql.map((migration) => migration.name)).toEqual(
      STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS.map((migration) => migration.name),
    );
    expect(sql.every((migration) => migration.sql.length > 0)).toBe(true);
  });

  it('requires the fixed source references and verifies only the fixed RBAC effects', () => {
    expect(() =>
      assertPinnedStagingRbacReferences(referenceRows()),
    ).not.toThrow();
    expect(() =>
      assertPinnedStagingRbacReferences(referenceRows().slice(1)),
    ).toThrow('reference set differs');

    const mappings = mappingRows();
    expect(() => assertPinnedStagingRbacMappingRows(mappings)).not.toThrow();
    expect(stagingRbacMappingsMatchExpected(mappings)).toBe(true);
    expect(() =>
      assertPinnedStagingRbacMappingsMatchExpected(mappings),
    ).not.toThrow();

    const mismatched = mappings.map((mapping) => ({ ...mapping }));
    mismatched[0].actualCount = 0;
    expect(stagingRbacMappingsMatchExpected(mismatched)).toBe(false);
    expect(() =>
      assertPinnedStagingRbacMappingsMatchExpected(mismatched),
    ).toThrow('effects do not match');
  });

  it('keeps the atomic ledger exception guarded, static, and independently post-checked', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts', 'qa', 'repair-staging-rbac-ledger.ts'),
      'utf8',
    );

    expect(source).toContain('assertQaWriteEnvironment(SCRIPT_NAME)');
    expect(source).toContain('assertQaStagingSentinel(');
    expect(source).toContain("await client.query('BEGIN')");
    expect(source).toContain('pg_advisory_xact_lock(72707369)');
    expect(source).toContain('INSERT INTO "_prisma_migrations"');
    expect(source).toContain('"applied_steps_count"');
    expect(source).toContain('NULL, NULL, $5, 1');
    expect(source).toContain('verifyCommittedRepairOnFreshConnection(');
    expect(source).toContain('inspectStagingMigrationLedger(');
    expect(source).toContain("resolve(process.cwd(), '.qa-runs')");
    expect(source).toContain('schemaFingerprintBefore');
    expect(source).toContain('schemaFingerprintAfter');
    expect(source).not.toContain('migrate resolve');
    for (const migration of STAGING_RBAC_LEDGER_REPAIR_MIGRATIONS) {
      expect(source).toContain(migration.name);
      expect(source).toContain(migration.sha256);
    }
  });
});
