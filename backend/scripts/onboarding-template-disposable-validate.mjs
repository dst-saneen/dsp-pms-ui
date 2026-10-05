#!/usr/bin/env node
/**
 * Disposable PostgreSQL rehearsal for Onboarding Template hardening.
 *
 * Usage:
 *   node scripts/onboarding-template-disposable-validate.mjs preflight
 *   ONBOARDING_VALIDATE_DATABASE_URL=postgresql://... \
 *     node scripts/onboarding-template-disposable-validate.mjs apply
 *
 * Safety:
 * - requires an explicit database URL for apply;
 * - refuses dsp_erp_dev unless ONBOARDING_ALLOW_SHARED_DEV=1 is explicitly set;
 * - creates one disposable schema, deploys all migrations twice, verifies the
 *   new database objects, then drops that schema by default.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const migrationName = '20260819130000_onboarding_template_p0_p1_hardening';
const migrationPath = resolve(
  backendRoot,
  'prisma/migrations',
  migrationName,
  'migration.sql',
);
const mode = process.argv[2] ?? 'preflight';

function normalizeUrl(rawUrl) {
  return rawUrl
    .trim()
    .replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://');
}

function assertSafeUrl(rawUrl) {
  if (!rawUrl?.trim()) {
    throw new Error(
      'Set ONBOARDING_VALIDATE_DATABASE_URL to an explicitly chosen disposable PostgreSQL database.',
    );
  }

  const url = new URL(normalizeUrl(rawUrl));
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (
    databaseName.includes('dsp_erp_dev') &&
    process.env.ONBOARDING_ALLOW_SHARED_DEV !== '1'
  ) {
    throw new Error(
      'Refusing dsp_erp_dev. Use a disposable database or set ONBOARDING_ALLOW_SHARED_DEV=1 only with explicit operations approval.',
    );
  }

  return { url, databaseName };
}

function schemaUrl(baseUrl, schema) {
  const url = new URL(baseUrl.toString());
  url.searchParams.set('schema', schema);
  return url.toString();
}

function adminUrl(baseUrl) {
  const url = new URL(baseUrl.toString());
  url.searchParams.delete('schema');
  return url.toString();
}

async function createPool(connectionString) {
  const { Pool } = await import('pg');
  const certificatePath = process.env.DATABASE_SSL_CA?.trim();
  const ssl = certificatePath
    ? {
        ca: readFileSync(resolve(backendRoot, certificatePath), 'utf8'),
        rejectUnauthorized: true,
      }
    : process.env.DATABASE_SSL_MODE?.trim() === 'require'
      ? { rejectUnauthorized: false }
      : undefined;

  return new Pool({ connectionString, ssl });
}

function runMigrateDeploy(databaseUrl, schema) {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATABASE_SCHEMA: schema,
    },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  if (result.status !== 0) {
    throw new Error(
      `Prisma migrate deploy failed in the disposable schema (exit ${result.status ?? 'unknown'}).`,
    );
  }
}

async function verifyObjects(pool, schema) {
  const constraints = [
    'OnboardingTemplateVersion_company_template_fkey',
    'designation_onboarding_assignments_company_designation_fkey',
    'designation_onboarding_assignments_company_branch_fkey',
    'designation_onboarding_assignments_company_template_fkey',
    'EmployeeOnboardingTask_employee_asset_result_fkey',
    'EmployeeOnboardingTask_license_allocation_result_fkey',
    'EmployeeOnboardingTask_asset_result_shape_check',
  ];
  const triggers = [
    'designation_onboarding_assignment_overlap_trg',
    'onboarding_department_template_immutable_trg',
    'onboarding_task_group_immutable_trg',
    'onboarding_template_task_immutable_trg',
    'onboarding_template_task_shape_guard_trg',
    'onboarding_template_version_publish_guard_trg',
  ];
  const indexes = [
    'designations_companyId_id_key',
    'EmployeeOnboardingTask_employeeAssetId_idx',
    'EmployeeOnboardingTask_softwareLicenseAllocationId_idx',
  ];

  const [{ rows: constraintRows }, { rows: triggerRows }, { rows: indexRows }] =
    await Promise.all([
      pool.query(
        `SELECT constraint_row.conname
         FROM pg_constraint AS constraint_row
         JOIN pg_class AS relation_row ON relation_row.oid = constraint_row.conrelid
         JOIN pg_namespace AS namespace_row ON namespace_row.oid = relation_row.relnamespace
         WHERE namespace_row.nspname = $1
           AND constraint_row.conname = ANY($2::text[])`,
        [schema, constraints],
      ),
      pool.query(
        `SELECT trigger_row.tgname
         FROM pg_trigger AS trigger_row
         JOIN pg_class AS relation_row ON relation_row.oid = trigger_row.tgrelid
         JOIN pg_namespace AS namespace_row ON namespace_row.oid = relation_row.relnamespace
         WHERE namespace_row.nspname = $1
           AND NOT trigger_row.tgisinternal
           AND trigger_row.tgname = ANY($2::text[])`,
        [schema, triggers],
      ),
      pool.query(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = $1
           AND indexname = ANY($2::text[])`,
        [schema, indexes],
      ),
    ]);

  const assertFound = (rows, key, expected, label) => {
    const found = new Set(rows.map((row) => row[key]));
    const missing = expected.filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new Error(`Missing ${label}: ${missing.join(', ')}`);
    }
  };

  assertFound(constraintRows, 'conname', constraints, 'constraints');
  assertFound(triggerRows, 'tgname', triggers, 'triggers');
  assertFound(indexRows, 'indexname', indexes, 'indexes');
}

function runPreflight() {
  if (!existsSync(migrationPath)) {
    throw new Error(`Missing migration: ${migrationPath}`);
  }

  const sql = readFileSync(migrationPath, 'utf8');
  const required = [
    'designation_onboarding_assignment_overlap_guard',
    'onboarding_reject_immutable_template_child',
    'onboarding_template_task_shape_guard',
    'onboarding_template_version_publish_guard',
    'EmployeeOnboardingTask_asset_result_shape_check',
  ];
  const missing = required.filter((token) => !sql.includes(token));
  if (missing.length > 0) {
    throw new Error(`Migration preflight missing: ${missing.join(', ')}`);
  }

  console.log(`Onboarding Template migration preflight passed: ${migrationName}`);
}

async function runApply() {
  const { url } = assertSafeUrl(process.env.ONBOARDING_VALIDATE_DATABASE_URL);
  const schema =
    process.env.ONBOARDING_DISPOSABLE_SCHEMA?.trim() ||
    `onboarding_template_rehearsal_${Date.now().toString(36)}`;

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('ONBOARDING_DISPOSABLE_SCHEMA is invalid.');
  }

  const pool = await createPool(adminUrl(url));
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    const targetUrl = schemaUrl(url, schema);

    runMigrateDeploy(targetUrl, schema);
    console.log('First migrate deploy completed.');

    const schemaPool = await createPool(targetUrl);
    try {
      await schemaPool.query(`SET search_path TO "${schema}"`);
      await verifyObjects(schemaPool, schema);
      console.log('Onboarding Template objects verified on disposable schema.');
    } finally {
      await schemaPool.end();
    }

    runMigrateDeploy(targetUrl, schema);
    console.log('Second migrate deploy completed (idempotent re-run).');

    console.log(`Disposable migration rehearsal passed in ${schema}.`);
  } finally {
    if (process.env.KEEP_ONBOARDING_DISPOSABLE_SCHEMA !== '1') {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      console.log(`Dropped disposable schema ${schema}.`);
    }
    await pool.end();
  }
}

async function runInspect() {
  const { url } = assertSafeUrl(process.env.ONBOARDING_VALIDATE_DATABASE_URL);
  const pool = await createPool(adminUrl(url));
  try {
    const { rows } = await pool.query(
      `SELECT nspname
       FROM pg_namespace
       WHERE nspname LIKE 'onboarding_template_rehearsal_%'
       ORDER BY nspname`,
    );
    console.log(`Remaining Onboarding rehearsal schemas: ${rows.length}`);
    for (const { nspname } of rows) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nspname)) {
        throw new Error('Encountered an invalid rehearsal schema name.');
      }
      const { rows: migrationRows } = await pool.query(
        `SELECT
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::int AS finished,
           COUNT(*) FILTER (WHERE finished_at IS NULL)::int AS unfinished
         FROM "${nspname}"."_prisma_migrations"`,
      );
      const result = migrationRows[0] ?? { count: 0, finished: 0, unfinished: 0 };
      console.log(
        `${nspname}: ${result.count} recorded, ${result.finished} finished, ${result.unfinished} unfinished migrations`,
      );
    }
  } finally {
    await pool.end();
  }
}

function namedRehearsalSchema() {
  const schema = process.env.ONBOARDING_DISPOSABLE_SCHEMA?.trim();
  if (!schema || !/^onboarding_template_rehearsal_[A-Za-z0-9_]+$/.test(schema)) {
    throw new Error(
      'ONBOARDING_DISPOSABLE_SCHEMA must name an Onboarding rehearsal schema.',
    );
  }
  return schema;
}

async function runVerify() {
  const { url } = assertSafeUrl(process.env.ONBOARDING_VALIDATE_DATABASE_URL);
  const schema = namedRehearsalSchema();
  const pool = await createPool(schemaUrl(url, schema));
  try {
    await pool.query(`SET search_path TO "${schema}"`);
    await verifyObjects(pool, schema);
    console.log(`Onboarding Template objects verified in ${schema}.`);
  } finally {
    await pool.end();
  }
}

async function runVerifySchema() {
  const { url } = assertSafeUrl(process.env.ONBOARDING_VALIDATE_DATABASE_URL);
  const schema = process.env.ONBOARDING_VERIFY_SCHEMA?.trim();
  if (!schema || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('ONBOARDING_VERIFY_SCHEMA is invalid.');
  }
  const pool = await createPool(schemaUrl(url, schema));
  try {
    await verifyObjects(pool, schema);
    console.log(`Onboarding Template objects verified in ${schema}.`);
  } finally {
    await pool.end();
  }
}

async function runCleanup() {
  const { url } = assertSafeUrl(process.env.ONBOARDING_VALIDATE_DATABASE_URL);
  const schema = namedRehearsalSchema();
  const pool = await createPool(adminUrl(url));
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log(`Dropped disposable schema ${schema}.`);
  } finally {
    await pool.end();
  }
}

async function runCreate() {
  const { url } = assertSafeUrl(process.env.ONBOARDING_VALIDATE_DATABASE_URL);
  const schema = namedRehearsalSchema();
  const pool = await createPool(adminUrl(url));
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    console.log(`Created disposable schema ${schema}.`);
  } finally {
    await pool.end();
  }
}

try {
  if (mode === 'preflight') {
    runPreflight();
  } else if (mode === 'apply') {
    await runApply();
  } else if (mode === 'inspect') {
    await runInspect();
  } else if (mode === 'verify') {
    await runVerify();
  } else if (mode === 'verify-schema') {
    await runVerifySchema();
  } else if (mode === 'cleanup') {
    await runCleanup();
  } else if (mode === 'create') {
    await runCreate();
  } else {
    throw new Error(
      'Usage: onboarding-template-disposable-validate.mjs <preflight|apply|inspect|verify|verify-schema|cleanup|create>',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
