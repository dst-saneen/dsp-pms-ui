import type { PoolClient } from 'pg';

import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  readRuntimeDatabaseIdentity,
  type RawQueryClient,
} from './assert-destructive-db-guard';
import { withOfficeFinancePayrollClient } from './office-finance-payroll-db';

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function asRawQueryClient(client: PoolClient): RawQueryClient {
  return {
    async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
      const result = await client.query(query, values);
      return result.rows as T;
    },
  };
}

async function main() {
  const apply = flag('apply');
  const writeTarget = apply
    ? assertQaWriteEnvironment('migration:finance-payroll:backfill')
    : undefined;

  await withOfficeFinancePayrollClient(async (client) => {
    const rawQueryClient = asRawQueryClient(client);
    const runtimeTarget = await readRuntimeDatabaseIdentity(
      rawQueryClient,
      'migration:finance-payroll:backfill',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        rawQueryClient,
        'migration:finance-payroll:backfill',
        writeTarget,
      );
    }

    const incomplete = await client.query<{ id: string }>(`
      SELECT id
      FROM finance_payment_accounts
      WHERE "bankReferenceEncrypted" IS NOT NULL
        AND (
          "bankReferenceEncNonce" IS NULL
          OR "bankReferenceEncTag" IS NULL
          OR "bankReferenceEncKeyVersion" IS NULL
          OR "bankLastFour" IS NULL
        )
    `);

    if (incomplete.rows.length > 0) {
      console.error(
        JSON.stringify({
          code: 'FINANCE_BANK_BACKFILL_BLOCKED',
          dryRun: !apply,
          target: runtimeTarget,
          count: incomplete.rows.length,
          sampleIds: incomplete.rows.slice(0, 20).map((row) => row.id),
          message:
            'Legacy bank-reference rows need an approved mapping/input file. Do not rewrite silently.',
        }),
      );
      process.exitCode = 1;
      return;
    }

    const postedMismatches = await client.query<{ id: string }>(`
      SELECT a.id
      FROM finance_payment_accounts a
      JOIN company_financial_profiles p ON a."companyId" = p."companyId"
      WHERE a."currencyCode" IS DISTINCT FROM p."baseCurrencyCode"
        AND EXISTS (
          SELECT 1
          FROM finance_transactions t
          WHERE t."companyId" = a."companyId"
            AND t."status" IN ('APPROVED', 'REVERSED')
            AND (t."sourceAccountId" = a.id OR t."destinationAccountId" = a.id)
        )
    `);

    if (postedMismatches.rows.length > 0) {
      console.error(
        JSON.stringify({
          code: 'FINANCE_ACCOUNT_CURRENCY_MISMATCH_BLOCKED',
          dryRun: !apply,
          target: runtimeTarget,
          count: postedMismatches.rows.length,
          sampleIds: postedMismatches.rows.slice(0, 20).map((row) => row.id),
          message:
            'Accounts with posted movements cannot have currency rewritten. Reconcile manually.',
        }),
      );
      process.exitCode = 1;
      return;
    }

    const eligible = await client.query<{ id: string }>(`
      SELECT a.id
      FROM finance_payment_accounts a
      JOIN company_financial_profiles p ON a."companyId" = p."companyId"
      WHERE a."currencyCode" IS DISTINCT FROM p."baseCurrencyCode"
        AND NOT EXISTS (
          SELECT 1
          FROM finance_transactions t
          WHERE t."companyId" = a."companyId"
            AND t."status" IN ('APPROVED', 'REVERSED')
            AND (t."sourceAccountId" = a.id OR t."destinationAccountId" = a.id)
        )
    `);

    if (!apply) {
      console.log(
        JSON.stringify({
          code: 'FINANCE_BACKFILL_DRY_RUN',
          dryRun: true,
          target: runtimeTarget,
          bankEnvelopeIncomplete: 0,
          accountCurrencyAlignmentPlanned: eligible.rows.length,
          sampleIds: eligible.rows.slice(0, 20).map((row) => row.id),
          message:
            'No finance records were changed. Re-run with --apply only in the guarded staging schema.',
        }),
      );
      return;
    }

    const aligned = await client.query(`
      UPDATE finance_payment_accounts a
      SET "currencyCode" = p."baseCurrencyCode"
      FROM company_financial_profiles p
      WHERE a."companyId" = p."companyId"
        AND a."currencyCode" IS DISTINCT FROM p."baseCurrencyCode"
        AND NOT EXISTS (
          SELECT 1
          FROM finance_transactions t
          WHERE t."companyId" = a."companyId"
            AND t."status" IN ('APPROVED', 'REVERSED')
            AND (t."sourceAccountId" = a.id OR t."destinationAccountId" = a.id)
        )
    `);

    console.log(
      JSON.stringify({
        code: 'FINANCE_BACKFILL_OK',
        dryRun: false,
        target: runtimeTarget,
        bankEnvelopeIncomplete: 0,
        accountCurrencyAligned: aligned.rowCount ?? 0,
      }),
    );
  });
}

void main();
