import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertNoCrossSchemaReferences,
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  createCanonicalStagingDatabaseUrl,
  QA_STAGING_TARGET,
  readRuntimeDatabaseIdentity,
  readQaSchemaFingerprint,
  type RawQueryClient,
} from '../../scripts/assert-destructive-db-guard';
import {
  migrationChecksumVariants,
  type RepositoryMigration,
} from '../../scripts/qa/migration-lineage';
import {
  createCanonicalPrismaChildEnvironment,
  createStagingMigrationDeployPlan,
  inspectStagingMigrationLedger,
  type StagingMigrationLedgerRow,
} from '../../scripts/qa/staging-migration-deploy-plan';

function validEnvironment(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    ALLOW_DESTRUCTIVE_DB_SCRIPTS: 'true',
    DATABASE_NAME: QA_STAGING_TARGET.databaseName,
    DATABASE_USER: QA_STAGING_TARGET.databaseUser,
    DATABASE_SCHEMA: QA_STAGING_TARGET.databaseSchema,
    DATABASE_URL:
      'postgresql://dscape:password@localhost:5432/dsp_erp_dev?schema=dsp_pms_stg',
    QA_STAGING_SENTINEL_KEY: QA_STAGING_TARGET.sentinelKey,
    QA_STAGING_CONFIRMATION_TOKEN: QA_STAGING_TARGET.confirmationToken,
  };
}

function repositoryMigration(
  name: string,
  sql = 'SELECT 1;\n',
): RepositoryMigration {
  return {
    name,
    checksums: migrationChecksumVariants(Buffer.from(sql, 'utf8')),
  };
}

function appliedLedgerRow(
  migration: RepositoryMigration,
): StagingMigrationLedgerRow {
  return {
    migrationName: migration.name,
    checksum: migration.checksums.exact,
    finishedAt: new Date('2026-09-18T00:00:00.000Z'),
    rolledBackAt: null,
  };
}

function approvedRuntimeTarget(): Record<string, unknown> {
  return {
    databaseName: QA_STAGING_TARGET.databaseName,
    databaseSchema: QA_STAGING_TARGET.databaseSchema,
    databaseSchemas: [QA_STAGING_TARGET.databaseSchema],
    databaseUser: QA_STAGING_TARGET.databaseUser,
    sentinelSchema: QA_STAGING_TARGET.databaseSchema,
    sentinelResolvesInApprovedSchema: true,
    sentinelPresent: true,
  };
}

describe('QA staging write safety', () => {
  it('plans a staging migration without opening a connection unless --apply is explicit', () => {
    const plan = createStagingMigrationDeployPlan([], {
      cwd: '/safe/backend',
      nodeExecutable: '/safe/node',
    });

    expect(plan).toMatchObject({
      mode: 'PLAN_ONLY',
      target: {
        databaseName: 'dsp_erp_dev',
        databaseUser: 'dscape',
        databaseSchema: 'dsp_pms_stg',
      },
      nodeExecutable: '/safe/node',
      prismaArguments: ['migrate', 'deploy'],
    });
    expect(plan.prismaCliPath).toBe(
      resolve('/safe/backend', 'node_modules', 'prisma', 'build', 'index.js'),
    );
  });

  it('requires the explicit --apply switch and rejects extra migration arguments', () => {
    expect(createStagingMigrationDeployPlan(['--apply']).mode).toBe('APPLY');
    expect(() =>
      createStagingMigrationDeployPlan(['migrate', 'deploy']),
    ).toThrow('Usage: qa:staging:migrate:deploy [--apply]');
  });

  it('computes only new repository migrations as pending', () => {
    const baseline = repositoryMigration('20260901000000_baseline');
    const pending = repositoryMigration('20260918000000_new_change');
    const preflight = inspectStagingMigrationLedger(
      [baseline, pending],
      [appliedLedgerRow(baseline)],
    );

    expect(
      preflight.pendingMigrations.map((migration) => migration.name),
    ).toEqual([pending.name]);
  });

  it('refuses an incomplete ledger that would replay immutable legacy history', () => {
    const immutableLegacy = repositoryMigration(
      '20260819140000_secure_file_storage_and_signed_offer',
    );
    const current = repositoryMigration('20260918000000_new_change');

    expect(() =>
      inspectStagingMigrationLedger([immutableLegacy, current], []),
    ).toThrow('Refusing to replay immutable legacy migrations');
    expect(() =>
      inspectStagingMigrationLedger(
        [immutableLegacy, current],
        [appliedLedgerRow(current)],
      ),
    ).toThrow('Refusing to replay immutable legacy migrations');
    expect(() =>
      inspectStagingMigrationLedger(
        [current],
        [
          {
            ...appliedLedgerRow(current),
            finishedAt: null,
          },
        ],
      ),
    ).toThrow('incomplete or rolled-back');
  });

  it('refuses checksum drift, unexpected ledger rows, and duplicate history', () => {
    const expected = repositoryMigration('20260918000000_expected');
    const other = repositoryMigration('20260918000000_other');

    expect(() =>
      inspectStagingMigrationLedger(
        [expected],
        [{ ...appliedLedgerRow(expected), checksum: 'wrong-checksum' }],
      ),
    ).toThrow('checksum mismatch');
    expect(() =>
      inspectStagingMigrationLedger(
        [expected],
        [appliedLedgerRow(expected), appliedLedgerRow(other)],
      ),
    ).toThrow('absent from this repository');
    expect(() =>
      inspectStagingMigrationLedger(
        [expected],
        [appliedLedgerRow(expected), appliedLedgerRow(expected)],
      ),
    ).toThrow('duplicate migrations');
  });

  it('refuses a historical migration gap instead of applying it after newer work', () => {
    const first = repositoryMigration('20260918000000_first');
    const missing = repositoryMigration('20260918000001_missing');
    const later = repositoryMigration('20260918000002_later');

    expect(() =>
      inspectStagingMigrationLedger(
        [first, missing, later],
        [appliedLedgerRow(first), appliedLedgerRow(later)],
      ),
    ).toThrow('non-contiguous history');
  });

  it('keeps Prisma staging deploy behind two independent sentinel checks', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts', 'qa', 'deploy-staging-migrations.ts'),
      'utf8',
    );

    expect(source).toContain('assertQaWriteEnvironment(SCRIPT_NAME)');
    expect(
      source.match(/await verifyStagingMigrationTarget\(target\)/g),
    ).toHaveLength(2);
    expect(source).toContain('runLocalPrismaDeploy(');
    expect(source).toContain('plan.prismaArguments');
    expect(source).toContain('shell: false');
    expect(source).toContain('inspectStagingMigrationLedger(');
    expect(source).toContain('createCanonicalPrismaChildEnvironment(');
    expect(source).toContain('assertPendingMigrationsAreSchemaNeutral(');
  });

  it('accepts only the exact configured staging target', () => {
    expect(assertQaWriteEnvironment('safe-writer', validEnvironment())).toEqual(
      {
        databaseName: 'dsp_erp_dev',
        databaseUser: 'dscape',
        databaseSchema: 'dsp_pms_stg',
        sentinelKey: 'DSP-ERP-QA-STAGING',
      },
    );
  });

  it('refuses the current schema before a database connection is opened', () => {
    const env = { ...validEnvironment(), DATABASE_SCHEMA: 'dsp_pms' };
    expect(() => assertQaWriteEnvironment('safe-writer', env)).toThrow(
      'Refusing current schema "dsp_pms"',
    );
  });

  it.each([
    ['DATABASE_NAME', 'DSP_ERP_DEV'],
    ['DATABASE_USER', 'DSCAPE'],
    ['DATABASE_SCHEMA', 'DSP_PMS_STG'],
  ])('requires a case-sensitive exact %s target value', (name, value) => {
    expect(() =>
      assertQaWriteEnvironment('safe-writer', {
        ...validEnvironment(),
        [name]: value,
      }),
    ).toThrow('must be exactly');
  });

  it.each([
    ['DATABASE_NAME', 'another_database'],
    ['DATABASE_USER', 'postgres'],
    ['DATABASE_SCHEMA', 'public'],
    ['QA_STAGING_SENTINEL_KEY', 'some-other-sentinel'],
    ['QA_STAGING_CONFIRMATION_TOKEN', 'yes'],
  ])('refuses a mismatched %s', (name, value) => {
    const env = { ...validEnvironment(), [name]: value };
    expect(() => assertQaWriteEnvironment('safe-writer', env)).toThrow();
  });

  it('refuses when DATABASE_URL points to a different database, user, or schema', () => {
    for (const databaseUrl of [
      'postgresql://dscape:password@localhost:5432/other?schema=dsp_pms_stg',
      'postgresql://postgres:password@localhost:5432/dsp_erp_dev?schema=dsp_pms_stg',
      'postgresql://dscape:password@localhost:5432/dsp_erp_dev?schema=dsp_pms',
      'postgresql://DSCAPE:password@localhost:5432/DSP_ERP_DEV?schema=DSP_PMS_STG',
    ]) {
      expect(() =>
        assertQaWriteEnvironment('safe-writer', {
          ...validEnvironment(),
          DATABASE_URL: databaseUrl,
        }),
      ).toThrow();
    }
  });

  it.each([
    'postgresql://dscape:password@localhost:5432/dsp_erp_dev?schema=dsp_pms_stg&options=-c%20search_path%3Ddsp_pms',
    'postgresql://dscape:password@localhost:5432/dsp_erp_dev?schema=dsp_pms_stg&search_path=dsp_pms',
    'postgresql://dscape:password@localhost:5432/dsp_erp_dev?schema=dsp_pms_stg&host=other-host',
    'postgresql://dscape:password@localhost:5432/dsp_erp_dev?schema=dsp_pms_stg&schema=dsp_pms',
  ])('refuses target-changing DATABASE_URL parameters: %s', (databaseUrl) => {
    expect(() =>
      assertQaWriteEnvironment('safe-writer', {
        ...validEnvironment(),
        DATABASE_URL: databaseUrl,
      }),
    ).toThrow('DATABASE_URL is invalid');
  });

  it('refuses libpq overrides and does not inherit them into Prisma', () => {
    expect(() =>
      assertQaWriteEnvironment('safe-writer', {
        ...validEnvironment(),
        PGOPTIONS: '-c search_path=dsp_pms',
      }),
    ).toThrow('PGOPTIONS is not permitted');

    const target = assertQaWriteEnvironment('safe-writer', validEnvironment());
    const childEnvironment = createCanonicalPrismaChildEnvironment(
      {
        ...validEnvironment(),
        APP_SECRET: 'must-not-reach-prisma',
        PATH: 'safe-path',
        PGHOST: 'unsafe-host',
        PGOPTIONS: '-c search_path=dsp_pms',
        PRISMA_SCHEMA_ENGINE_BINARY: 'unsafe-engine',
      },
      target,
    );

    expect(childEnvironment).toMatchObject({
      DATABASE_NAME: QA_STAGING_TARGET.databaseName,
      DATABASE_USER: QA_STAGING_TARGET.databaseUser,
      DATABASE_SCHEMA: QA_STAGING_TARGET.databaseSchema,
      PATH: 'safe-path',
    });
    expect(childEnvironment.DATABASE_URL).toBe(
      createCanonicalStagingDatabaseUrl(
        validEnvironment().DATABASE_URL,
        target,
      ),
    );
    expect(
      Object.keys(childEnvironment).some((name) => /^PG/i.test(name)),
    ).toBe(false);
    expect(childEnvironment).not.toHaveProperty('APP_SECRET');
    expect(childEnvironment).not.toHaveProperty('PRISMA_SCHEMA_ENGINE_BINARY');
  });

  it('permanently retires the unsafe first-record UAT setup and fix scripts', () => {
    expect(() =>
      assertQaWriteEnvironment('e2e-uat-setup', validEnvironment()),
    ).toThrow('is retired');
    expect(() =>
      assertQaWriteEnvironment('e2e-uat-fix', validEnvironment()),
    ).toThrow('is retired');
  });

  it('authorizes a connection only when the exact enabled sentinel is present', async () => {
    const queryClient = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([approvedRuntimeTarget()]),
    } as unknown as RawQueryClient;

    await expect(
      assertQaStagingSentinel(
        queryClient,
        'safe-writer',
        assertQaWriteEnvironment('safe-writer', validEnvironment()),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      databaseName: 'another_database',
      databaseSchema: 'dsp_pms_stg',
      databaseUser: 'dscape',
      sentinelPresent: true,
    },
    {
      databaseName: 'dsp_erp_dev',
      databaseSchema: 'dsp_pms',
      databaseUser: 'dscape',
      sentinelPresent: true,
    },
    {
      databaseName: 'dsp_erp_dev',
      databaseSchema: 'dsp_pms_stg',
      databaseUser: 'postgres',
      sentinelPresent: true,
    },
    {
      databaseName: 'dsp_erp_dev',
      databaseSchema: 'dsp_pms_stg',
      databaseUser: 'dscape',
      sentinelPresent: false,
    },
  ])('refuses runtime target mismatch %#', async (runtime) => {
    const queryClient = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([runtime]),
    } as unknown as RawQueryClient;
    await expect(
      assertQaStagingSentinel(
        queryClient,
        'safe-writer',
        assertQaWriteEnvironment('safe-writer', validEnvironment()),
      ),
    ).rejects.toThrow();
  });

  it.each([
    {
      ...approvedRuntimeTarget(),
      databaseSchemas: ['dsp_pms_stg', 'public'],
    },
    {
      ...approvedRuntimeTarget(),
      sentinelSchema: 'public',
    },
    {
      ...approvedRuntimeTarget(),
      sentinelResolvesInApprovedSchema: false,
    },
    {
      ...approvedRuntimeTarget(),
      databaseUser: 'DSCAPE',
    },
  ])(
    'refuses a search_path or sentinel fallback bypass %#',
    async (runtime) => {
      const queryClient = {
        $queryRawUnsafe: jest.fn().mockResolvedValue([runtime]),
      } as unknown as RawQueryClient;
      await expect(
        assertQaStagingSentinel(
          queryClient,
          'safe-writer',
          assertQaWriteEnvironment('safe-writer', validEnvironment()),
        ),
      ).rejects.toThrow();
    },
  );

  it('fails closed when the sentinel table cannot be queried', async () => {
    const queryClient = {
      $queryRawUnsafe: jest
        .fn()
        .mockRejectedValue(new Error('missing relation')),
    } as unknown as RawQueryClient;
    await expect(
      assertQaStagingSentinel(
        queryClient,
        'safe-writer',
        assertQaWriteEnvironment('safe-writer', validEnvironment()),
      ),
    ).rejects.toThrow('no writes were authorized');
  });

  it('reports the actual connected target for a dry-run without authorizing a write', async () => {
    const queryClient = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          databaseName: 'dsp_erp_dev',
          databaseSchema: 'dsp_pms_stg',
          databaseUser: 'dscape',
        },
      ]),
    } as unknown as RawQueryClient;

    await expect(
      readRuntimeDatabaseIdentity(queryClient, 'safe-dry-run'),
    ).resolves.toEqual({
      databaseName: 'dsp_erp_dev',
      databaseSchema: 'dsp_pms_stg',
      databaseUser: 'dscape',
    });
  });

  it.each([
    ['asset-backfill.ts', 'migration:assets:backfill'],
    ['delivery-backfill.ts', 'migration:delivery:backfill'],
    ['projects-backfill.ts', 'migration:projects:backfill'],
    ['business-calendar-stage5-backfill.ts', 'migration:calendar:backfill'],
    ['business-calendar-stage5-shadow.ts', 'migration:calendar:shadow'],
    ['provision-business-calendars.ts', 'migration:calendar:provision'],
    [
      'office-finance-payroll-backfill.ts',
      'migration:finance-payroll:backfill',
    ],
  ])(
    'requires the QA guard before %s can perform %s writes',
    (fileName, scriptName) => {
      const source = readFileSync(
        resolve(process.cwd(), 'scripts', fileName),
        'utf8',
      );
      const escapedScriptName = scriptName.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );

      expect(source).toMatch(
        new RegExp(
          `assertQaWriteEnvironment\\(['"]${escapedScriptName}['"]\\)`,
        ),
      );
      expect(source).toContain('assertQaStagingSentinel(');
    },
  );

  it('requires the exact staging guard and sentinel before company deletion can mutate data', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts', 'delete-company-by-code.ts'),
      'utf8',
    );

    expect(source).toContain(
      "assertQaWriteEnvironment('delete-company-by-code')",
    );
    expect(source).toContain('assertQaStagingSentinel(');
    expect(source).toContain('QA_STAGING_TARGET.currentSchema');
    expect(source).not.toContain("DATABASE_SCHEMA || 'dsp_pms'");
  });

  it('rejects cross-schema SQL and search_path changes', () => {
    expect(() =>
      assertNoCrossSchemaReferences(
        'UPDATE "dsp_pms"."users" SET status = \'ACTIVE\'',
      ),
    ).toThrow('references schema "dsp_pms"');
    expect(() =>
      assertNoCrossSchemaReferences('DELETE FROM public.users'),
    ).toThrow('references schema "public"');
    expect(() =>
      assertNoCrossSchemaReferences('SET search_path TO dsp_pms_stg'),
    ).toThrow('must not change search_path');
  });

  it('allows unqualified SQL and an explicit reference to the exact target', () => {
    expect(() =>
      assertNoCrossSchemaReferences("UPDATE users SET status = 'ACTIVE'"),
    ).not.toThrow();
    expect(() =>
      assertNoCrossSchemaReferences(
        'UPDATE "dsp_pms_stg"."users" SET status = \'ACTIVE\'',
      ),
    ).not.toThrow();
  });

  it('creates deterministic structural fingerprints', async () => {
    const rows = [
      {
        objectType: 'column',
        objectName: 'users.id',
        objectDefinition: 'text:NO:',
      },
    ];
    const queryClient = {
      $queryRawUnsafe: jest.fn().mockResolvedValue(rows),
    } as unknown as RawQueryClient;
    const first = await readQaSchemaFingerprint(queryClient);
    const second = await readQaSchemaFingerprint(queryClient);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });
});
