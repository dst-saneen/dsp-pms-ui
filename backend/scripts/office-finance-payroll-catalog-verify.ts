import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
const databaseSchema = process.env.DATABASE_SCHEMA?.trim();
const sslCaPath = process.env.DATABASE_SSL_CA?.trim();

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

if (!databaseSchema) {
  throw new Error('DATABASE_SCHEMA is required.');
}

const runtimeUrl = new URL(
  databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
);
runtimeUrl.searchParams.delete('schema');
runtimeUrl.searchParams.set('schema', databaseSchema);

const pool = new Pool({
  connectionString: runtimeUrl.toString(),
  ssl: sslCaPath
    ? {
        ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
        rejectUnauthorized: true,
      }
    : undefined,
  options: `-c search_path=${databaseSchema}`,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${databaseSchema}`);

    const columns = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (
          (table_name = 'finance_payment_accounts' AND column_name IN (
            'bankReferenceEncNonce',
            'bankReferenceEncTag',
            'bankReferenceEncKeyVersion',
            'bankReferenceEncFormatVersion'
          ))
          OR (table_name = 'PayrollPayslip' AND column_name IN (
            'generationLeaseId',
            'generationLeaseExpiresAt',
            'generationAttemptCount',
            'lastAttemptAt'
          ))
        )
      ORDER BY table_name, column_name
    `);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'GeneratedFileIntent'
    `);

    const droppedUnique = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'PayrollRun_companyId_payrollYear_payrollMonth_key'
    `);

    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname IN (
          'PayrollRun_companyId_payrollYear_payrollMonth_key',
          'PayrollRun_companyId_payrollYear_payrollMonth_idx',
          'PayrollRun_companyId_payrollYear_payrollMonth_active_key',
          'OvertimeRequest_companyId_id_key',
          'finance_transactions_reversalOfTransactionId_key'
        )
      ORDER BY indexname
    `);

    const triggers = await client.query(`
      SELECT t.tgname, t.tgenabled::text AS tgenabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema()
        AND NOT t.tgisinternal
        AND t.tgname IN (
          'finance_transactions_self_approval',
          'finance_transactions_reversal_copy',
          'finance_transactions_prevent_update',
          'finance_payment_accounts_opening_balance_lock',
          'payroll_runs_prevent_frozen_update',
          'payroll_run_employees_snapshot_guard',
          'payroll_run_employee_lines_snapshot_guard',
          'payroll_run_attendance_snapshot_guard'
        )
      ORDER BY t.tgname
    `);

    const functions = await client.query(`
      SELECT p.proname, (pg_get_functiondef(p.oid) LIKE '%REVERSAL%') AS has_reversal
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = current_schema()
        AND p.proname IN (
          'finance_prevent_self_approval',
          'finance_validate_reversal_copy',
          'finance_prevent_approved_update',
          'finance_prevent_opening_balance_change',
          'payroll_prevent_frozen_run_update',
          'payroll_prevent_snapshot_mutation',
          'payroll_prevent_line_snapshot_mutation',
          'payroll_prevent_attendance_snapshot_mutation'
        )
      ORDER BY p.proname
    `);

    const constraints = await client.query(`
      SELECT conname
      FROM pg_constraint
      JOIN pg_namespace n ON n.oid = pg_constraint.connamespace
      WHERE n.nspname = current_schema()
        AND conname IN (
          'finance_payment_accounts_bank_envelope_chk',
          'PayrollRunEmployeeLine_company_salaryComponent_fkey',
          'PayrollRunEmployeeLine_company_taxProfile_fkey',
          'PayrollRunEmployeeLine_company_recurringDeduction_fkey',
          'PayrollRunEmployeeLine_company_adjustment_fkey',
          'PayrollRunEmployeeLine_company_overtimeRequest_fkey',
          'GeneratedFileIntent_companyId_fkey'
        )
      ORDER BY conname
    `);

    const migrations = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE migration_name IN (
        '20260821180000_office_finance_payroll_release_expand',
        '20260821181000_office_finance_payroll_release_contract'
      )
      ORDER BY migration_name
    `);

    console.log(
      JSON.stringify(
        {
          schema: databaseSchema,
          columns: columns.rows,
          tables: tables.rows,
          droppedFullPayrollPeriodUnique: droppedUnique.rows,
          indexes: indexes.rows,
          triggers: triggers.rows,
          functions: functions.rows,
          constraints: constraints.rows,
          migrations: migrations.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
