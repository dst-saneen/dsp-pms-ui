import { withOfficeFinancePayrollClient } from '../../scripts/office-finance-payroll-db';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase('Office Finance / Payroll catalog contract', () => {
  it('keeps the reversal self-approval exemption and original-row guards', async () => {
    await withOfficeFinancePayrollClient(async (client) => {
      const rows = await client.query<{ prosrc: string }>(`
        SELECT pg_get_functiondef(p.oid) AS prosrc
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = current_schema()
          AND p.proname = 'finance_prevent_self_approval'
      `);

      expect(rows.rows.length).toBeGreaterThan(0);
      const body = rows.rows.map((row) => row.prosrc).join('\n');
      expect(body).toContain('REVERSAL');
      expect(body).toContain('reversalOfTransactionId');
      expect(body).toContain('APPROVED');
      expect(body).not.toContain('PAYROLL');
    });
  });

  it('uses a partial unique index for non-cancelled payroll periods', async () => {
    await withOfficeFinancePayrollClient(async (client) => {
      const rows = await client.query<{ indexdef: string }>(`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'PayrollRun_companyId_payrollYear_payrollMonth_active_key'
      `);

      expect(rows.rows[0]?.indexdef ?? '').toMatch(/WHERE/i);
      expect(rows.rows[0]?.indexdef ?? '').toMatch(/CANCELLED/);
      expect(rows.rows[0]?.indexdef ?? '').toMatch(/payrollYear/);
      expect(rows.rows[0]?.indexdef ?? '').toMatch(/payrollMonth/);
    });
  });

  it('has freeze and reversal copy functions enabled', async () => {
    await withOfficeFinancePayrollClient(async (client) => {
      const functions = await client.query<{ proname: string }>(`
        SELECT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = current_schema()
          AND p.proname IN (
            'finance_validate_reversal_copy',
            'finance_prevent_approved_update',
            'finance_prevent_opening_balance_change',
            'payroll_prevent_frozen_run_update',
            'payroll_prevent_snapshot_mutation'
          )
      `);
      expect(functions.rows.length).toBeGreaterThanOrEqual(4);
    });
  });
});
