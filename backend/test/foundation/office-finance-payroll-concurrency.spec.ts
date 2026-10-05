/**
 * Real PostgreSQL concurrency evidence for Finance/Payroll uniqueness and CAS.
 * Skipped unless DATABASE_URL and OFFICE_FINANCE_PAYROLL_CONCURRENCY=1 are set.
 * Refuses production-like / shared app database names unless CONCURRENCY_ALLOW_SHARED=1.
 */
import { randomUUID } from 'node:crypto';
import { type PoolClient } from 'pg';

import { createOfficeFinancePayrollPool } from '../../scripts/office-finance-payroll-db';

const describeIfConcurrency =
  process.env.DATABASE_URL &&
  process.env.OFFICE_FINANCE_PAYROLL_CONCURRENCY === '1'
    ? describe
    : describe.skip;

function assertConcurrencyDatabaseAllowed() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  let databaseName = '';
  try {
    databaseName = new URL(
      databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
    ).pathname
      .replace(/^\//, '')
      .toLowerCase();
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }

  const looksShared =
    databaseName.includes('prod') ||
    databaseName.includes('production') ||
    databaseName === 'dsp_pms' ||
    databaseName.endsWith('_pms');

  if (looksShared && process.env.CONCURRENCY_ALLOW_SHARED !== '1') {
    throw new Error(
      `Refusing concurrency tests against ${databaseName}. Use a disposable database or set CONCURRENCY_ALLOW_SHARED=1.`,
    );
  }
}

async function withTwoClients<T>(
  run: (left: PoolClient, right: PoolClient) => Promise<T>,
): Promise<T> {
  const leftCreated = createOfficeFinancePayrollPool();
  const rightCreated = createOfficeFinancePayrollPool();
  const left = await leftCreated.pool.connect();
  const right = await rightCreated.pool.connect();
  try {
    await left.query(`SET search_path TO ${leftCreated.schema}`);
    await right.query(`SET search_path TO ${rightCreated.schema}`);
    return await run(left, right);
  } finally {
    left.release();
    right.release();
    await leftCreated.pool.end();
    await rightCreated.pool.end();
  }
}

const TEST_PASSWORD_HASH = '$2b$12$concurrency-fixture-password-hash';

interface TenantFixture {
  companyId: string;
  userIds: string[];
}

interface PayrollFixture extends TenantFixture {
  branchId: string;
  departmentId: string;
  employeeId: string;
}

async function createTenantFixture(
  client: PoolClient,
  prefix: string,
  userCount = 1,
): Promise<TenantFixture> {
  const companyId = randomUUID();
  const companyCode = `${prefix}-${companyId.slice(0, 8)}`;
  const userIds = Array.from({ length: userCount }, () => randomUUID());

  await client.query(
    `INSERT INTO companies (id, "companyCode", "companyName", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NOW(), NOW())`,
    [companyId, companyCode, `Concurrency ${companyCode}`],
  );

  for (const [index, userId] of userIds.entries()) {
    const username = `${prefix.toLowerCase()}-${companyId.slice(0, 8)}-${index}`;
    await client.query(
      `INSERT INTO users (
         id, username, "normalizedUsername", "passwordHash", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $2, $3, NOW(), NOW())`,
      [userId, username, TEST_PASSWORD_HASH],
    );
  }

  return { companyId, userIds };
}

async function createPayrollFixture(
  client: PoolClient,
  prefix: string,
  userCount = 1,
): Promise<PayrollFixture> {
  const tenant = await createTenantFixture(client, prefix, userCount);
  const branchId = randomUUID();
  const departmentId = randomUUID();
  const employeeId = randomUUID();
  const employeeCode = `${prefix}${employeeId.slice(0, 8)}`.slice(0, 40);

  await client.query(
    `INSERT INTO branches (
       id, "companyId", "branchCode", "branchName", "isActive", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
    [branchId, tenant.companyId, `B-${prefix}`, `Branch ${prefix}`],
  );
  await client.query(
    `INSERT INTO departments (
       id, "companyId", "branchId", "departmentCode", "departmentName", "isActive", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
    [
      departmentId,
      tenant.companyId,
      branchId,
      `D-${prefix}`,
      `Department ${prefix}`,
    ],
  );
  await client.query(
    `INSERT INTO employees (
       id, "employeeCode", "companyId", "branchId", "departmentId", "firstName",
       "employmentStatus", "isActive", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'Concurrent', 'ACTIVE', true, NOW(), NOW())`,
    [employeeId, employeeCode, tenant.companyId, branchId, departmentId],
  );

  return { ...tenant, branchId, departmentId, employeeId };
}

async function cleanupFixture(
  client: PoolClient,
  fixture: TenantFixture,
): Promise<void> {
  const { companyId, userIds } = fixture;

  await client.query(
    `DELETE FROM "GeneratedFileIntent" WHERE "companyId" = $1`,
    [companyId],
  );
  await client.query(`DELETE FROM "PayrollPayslip" WHERE "companyId" = $1`, [
    companyId,
  ]);
  await client.query(
    `DELETE FROM "PayrollRunAdjustment" WHERE "companyId" = $1`,
    [companyId],
  );
  await client.query(
    `UPDATE "PayrollRun"
     SET status = 'CANCELLED', "statusEnum" = 'CANCELLED', "updatedAt" = NOW()
     WHERE "companyId" = $1 AND "statusEnum" IN ('CALCULATED', 'APPROVED')`,
    [companyId],
  );
  await client.query(
    `DELETE FROM "PayrollRunEmployee" WHERE "companyId" = $1`,
    [companyId],
  );
  await client.query(`DELETE FROM "PayrollRun" WHERE "companyId" = $1`, [
    companyId,
  ]);
  await client.query(`DELETE FROM finance_periods WHERE "companyId" = $1`, [
    companyId,
  ]);
  await client.query(
    `DELETE FROM finance_transactions WHERE "companyId" = $1`,
    [companyId],
  );
  await client.query(
    `DELETE FROM company_financial_profiles WHERE "companyId" = $1`,
    [companyId],
  );
  await client.query(`DELETE FROM finance_categories WHERE "companyId" = $1`, [
    companyId,
  ]);
  await client.query(
    `DELETE FROM finance_payment_accounts WHERE "companyId" = $1`,
    [companyId],
  );
  await client.query(`DELETE FROM employees WHERE "companyId" = $1`, [
    companyId,
  ]);
  await client.query(`DELETE FROM departments WHERE "companyId" = $1`, [
    companyId,
  ]);
  await client.query(`DELETE FROM branches WHERE "companyId" = $1`, [
    companyId,
  ]);
  if (userIds.length > 0) {
    await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
      userIds,
    ]);
  }
  await client.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
}

async function expectFailureInSavepoint(
  client: PoolClient,
  action: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await client.query('SAVEPOINT expected_concurrency_failure');
  let failure: unknown;
  try {
    await action();
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT expected_concurrency_failure');
  await client.query('RELEASE SAVEPOINT expected_concurrency_failure');
  expect(String((failure as { message?: string })?.message ?? failure)).toMatch(
    pattern,
  );
}

describeIfConcurrency('Office Finance / Payroll PostgreSQL concurrency', () => {
  beforeAll(() => {
    assertConcurrencyDatabaseAllowed();
  });

  it('allows only one non-cancelled payroll run per company month under concurrent insert', async () => {
    await withTwoClients(async (left, right) => {
      const companyId = randomUUID();
      const companyCode = `CONC-${companyId.slice(0, 8)}`;
      await left.query(
        `INSERT INTO companies (id, "companyCode", "companyName", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [companyId, companyCode, `Concurrency ${companyCode}`],
      );

      const year = 2099;
      const month = 12;
      const insertSql = `
        INSERT INTO "PayrollRun" (id, "companyId", "payrollYear", "payrollMonth", status, "statusEnum", version, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'DRAFT', 'DRAFT', 0, NOW(), NOW())
      `;

      try {
        const results = await Promise.allSettled([
          left.query(insertSql, [randomUUID(), companyId, year, month]),
          right.query(insertSql, [randomUUID(), companyId, year, month]),
        ]);

        const fulfilled = results.filter((row) => row.status === 'fulfilled');
        const rejected = results.filter((row) => row.status === 'rejected');
        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);

        const uniqueViolation = rejected[0];
        expect(uniqueViolation.status).toBe('rejected');
        if (uniqueViolation.status === 'rejected') {
          const message = String(
            (uniqueViolation.reason as { message?: string })?.message ??
              uniqueViolation.reason,
          );
          expect(message).toMatch(
            /PayrollRun_companyId_payrollYear_payrollMonth_active_key|duplicate key/i,
          );
        }
      } finally {
        await left.query(`DELETE FROM "PayrollRun" WHERE "companyId" = $1`, [
          companyId,
        ]);
        await left.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
      }
    });
  });

  it('lets only one concurrent CAS version bump succeed on a payroll run', async () => {
    await withTwoClients(async (left, right) => {
      const companyId = randomUUID();
      const runId = randomUUID();
      const companyCode = `CAS-${companyId.slice(0, 8)}`;
      await left.query(
        `INSERT INTO companies (id, "companyCode", "companyName", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [companyId, companyCode, `CAS ${companyCode}`],
      );
      await left.query(
        `INSERT INTO "PayrollRun" (id, "companyId", "payrollYear", "payrollMonth", status, "statusEnum", version, "createdAt", "updatedAt")
         VALUES ($1, $2, 2098, 11, 'DRAFT', 'DRAFT', 0, NOW(), NOW())`,
        [runId, companyId],
      );

      const casSql = `
        UPDATE "PayrollRun"
        SET version = version + 1, "updatedAt" = NOW()
        WHERE id = $1 AND version = 0
      `;

      try {
        const results = await Promise.all([
          left.query(casSql, [runId]),
          right.query(casSql, [runId]),
        ]);
        const winners = results.filter((row) => row.rowCount === 1);
        expect(winners).toHaveLength(1);

        const current = await left.query<{ version: number }>(
          `SELECT version FROM "PayrollRun" WHERE id = $1`,
          [runId],
        );
        expect(current.rows[0]?.version).toBe(1);
      } finally {
        await left.query(`DELETE FROM "PayrollRun" WHERE id = $1`, [runId]);
        await left.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
      }
    });
  });

  it('lets only one concurrent Finance transaction state transition succeed', async () => {
    await withTwoClients(async (left, right) => {
      const companyId = randomUUID();
      const userId = randomUUID();
      const transactionId = randomUUID();
      const companyCode = `FINCAS-${companyId.slice(0, 8)}`;
      await left.query(
        `INSERT INTO companies (id, "companyCode", "companyName", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [companyId, companyCode, `Finance CAS ${companyCode}`],
      );
      await left.query(
        `INSERT INTO users (
           id, username, "normalizedUsername", "passwordHash", "createdAt", "updatedAt"
         ) VALUES ($1, $2, $3, '$2b$12$concurrency-fixture-password-hash', NOW(), NOW())`,
        [
          userId,
          `finance-${userId.slice(0, 8)}`,
          `finance-${userId.slice(0, 8)}`,
        ],
      );
      await left.query(
        `INSERT INTO finance_transactions (
           id, "companyId", "transactionNumber", "transactionDate", "transactionType",
           status, amount, "currencyCode", description, "createdByUserId", version,
           "createdAt", "updatedAt"
         ) VALUES ($1, $2, $3, DATE '2098-11-01', 'TRANSFER', 'DRAFT', 1.00, 'INR', 'CAS', $4, 0, NOW(), NOW())`,
        [transactionId, companyId, `FT-${transactionId.slice(0, 8)}`, userId],
      );

      const casSql = `
        UPDATE finance_transactions
        SET status = 'CANCELLED', version = version + 1, "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2 AND version = 0 AND status = 'DRAFT'
      `;

      try {
        const results = await Promise.all([
          left.query(casSql, [transactionId, companyId]),
          right.query(casSql, [transactionId, companyId]),
        ]);
        expect(results.filter((row) => row.rowCount === 1)).toHaveLength(1);

        const current = await left.query<{ version: number; status: string }>(
          `SELECT version, status FROM finance_transactions WHERE id = $1`,
          [transactionId],
        );
        expect(current.rows[0]).toMatchObject({
          version: 1,
          status: 'CANCELLED',
        });
      } finally {
        await left.query(`DELETE FROM finance_transactions WHERE id = $1`, [
          transactionId,
        ]);
        await left.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await left.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
      }
    });
  });

  it('lets only one concurrent Finance period lock and reopen CAS succeed', async () => {
    await withTwoClients(async (left, right) => {
      const companyId = randomUUID();
      const userId = randomUUID();
      const periodId = randomUUID();
      const companyCode = `PERIODCAS-${companyId.slice(0, 8)}`;
      await left.query(
        `INSERT INTO companies (id, "companyCode", "companyName", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [companyId, companyCode, `Period CAS ${companyCode}`],
      );
      await left.query(
        `INSERT INTO users (
           id, username, "normalizedUsername", "passwordHash", "createdAt", "updatedAt"
         ) VALUES ($1, $2, $3, '$2b$12$concurrency-fixture-password-hash', NOW(), NOW())`,
        [
          userId,
          `period-${userId.slice(0, 8)}`,
          `period-${userId.slice(0, 8)}`,
        ],
      );
      await left.query(
        `INSERT INTO finance_periods (
           id, "companyId", "periodYear", "periodMonth", "periodStart", "periodEnd",
           status, version, "createdByUserId", "createdAt", "updatedAt"
         ) VALUES ($1, $2, 2098, 11, DATE '2098-11-01', DATE '2098-11-30', 'OPEN', 0, $3, NOW(), NOW())`,
        [periodId, companyId, userId],
      );

      const casSql = `
        UPDATE finance_periods
        SET status = 'LOCKED', version = version + 1, "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2 AND version = 0 AND status = 'OPEN'
      `;

      try {
        const results = await Promise.all([
          left.query(casSql, [periodId, companyId]),
          right.query(casSql, [periodId, companyId]),
        ]);
        expect(results.filter((row) => row.rowCount === 1)).toHaveLength(1);

        const current = await left.query<{ version: number; status: string }>(
          `SELECT version, status FROM finance_periods WHERE id = $1`,
          [periodId],
        );
        expect(current.rows[0]).toMatchObject({ version: 1, status: 'LOCKED' });

        const reopenSql = `
          UPDATE finance_periods
          SET status = 'OPEN', version = version + 1, "updatedAt" = NOW()
          WHERE id = $1 AND "companyId" = $2 AND version = 1 AND status = 'LOCKED'
        `;
        const reopenResults = await Promise.all([
          left.query(reopenSql, [periodId, companyId]),
          right.query(reopenSql, [periodId, companyId]),
        ]);
        expect(reopenResults.filter((row) => row.rowCount === 1)).toHaveLength(
          1,
        );

        const reopened = await left.query<{ version: number; status: string }>(
          `SELECT version, status FROM finance_periods WHERE id = $1`,
          [periodId],
        );
        expect(reopened.rows[0]).toMatchObject({ version: 2, status: 'OPEN' });
      } finally {
        await left.query(`DELETE FROM finance_periods WHERE id = $1`, [
          periodId,
        ]);
        await left.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await left.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
      }
    });
  });

  it('fences concurrent Finance draft edits and submission with the expected CAS predicates', async () => {
    await withTwoClients(async (left, right) => {
      let fixture: TenantFixture | undefined;
      try {
        fixture = await createTenantFixture(left, 'FINDRAFT');
        const [userId] = fixture.userIds;
        const editableTransactionId = randomUUID();
        const submittedTransactionId = randomUUID();

        await left.query(
          `INSERT INTO finance_transactions (
             id, "companyId", "transactionNumber", "transactionDate", "transactionType",
             status, amount, "currencyCode", description, "createdByUserId", version,
             "createdAt", "updatedAt"
           ) VALUES
             ($1, $2, $3, DATE '2097-10-01', 'EXPENSE', 'DRAFT', 1.00, 'INR', 'before edit', $4, 0, NOW(), NOW()),
             ($5, $2, $6, DATE '2097-10-02', 'EXPENSE', 'DRAFT', 1.00, 'INR', 'before submit', $4, 0, NOW(), NOW())`,
          [
            editableTransactionId,
            fixture.companyId,
            `FT-${editableTransactionId.slice(0, 8)}`,
            userId,
            submittedTransactionId,
            `FT-${submittedTransactionId.slice(0, 8)}`,
          ],
        );

        const editSql = `
          UPDATE finance_transactions
          SET description = 'edited once', version = version + 1, "updatedAt" = NOW()
          WHERE id = $1 AND "companyId" = $2 AND version = 0 AND status = 'DRAFT'
        `;
        const editResults = await Promise.all([
          left.query(editSql, [editableTransactionId, fixture.companyId]),
          right.query(editSql, [editableTransactionId, fixture.companyId]),
        ]);
        expect(editResults.filter((row) => row.rowCount === 1)).toHaveLength(1);

        const submitSql = `
          UPDATE finance_transactions
          SET status = 'SUBMITTED', "submittedByUserId" = $3, "submittedAt" = NOW(),
              version = version + 1, "updatedAt" = NOW()
          WHERE id = $1 AND "companyId" = $2 AND version = 0 AND status = 'DRAFT'
        `;
        const submitResults = await Promise.all([
          left.query(submitSql, [
            submittedTransactionId,
            fixture.companyId,
            userId,
          ]),
          right.query(submitSql, [
            submittedTransactionId,
            fixture.companyId,
            userId,
          ]),
        ]);
        expect(submitResults.filter((row) => row.rowCount === 1)).toHaveLength(
          1,
        );

        const rows = await left.query<{
          id: string;
          status: string;
          version: number;
          description: string;
        }>(
          `SELECT id, status, version, description
           FROM finance_transactions
           WHERE id = ANY($1::text[])
           ORDER BY id`,
          [[editableTransactionId, submittedTransactionId]],
        );
        expect(rows.rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: editableTransactionId,
              status: 'DRAFT',
              version: 1,
              description: 'edited once',
            }),
            expect.objectContaining({
              id: submittedTransactionId,
              status: 'SUBMITTED',
              version: 1,
            }),
          ]),
        );
      } finally {
        if (fixture) await cleanupFixture(left, fixture);
      }
    });
  });

  it('enforces Finance approve/reverse and Payroll lifecycle CAS in a rolled-back history transaction', async () => {
    await withTwoClients(async (left) => {
      await left.query('BEGIN');
      try {
        const fixture = await createTenantFixture(left, 'HISTORYCAS', 3);
        const [creatorUserId, calculatorUserId, approverUserId] =
          fixture.userIds;
        const transactionId = randomUUID();
        const reversalId = randomUUID();

        await left.query(
          `INSERT INTO finance_transactions (
             id, "companyId", "transactionNumber", "transactionDate", "transactionType",
             status, amount, "currencyCode", description, "createdByUserId", version,
             "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, DATE '2097-09-01', 'EXPENSE', 'DRAFT', 1.00, 'INR', 'history row', $4, 0, NOW(), NOW())`,
          [
            transactionId,
            fixture.companyId,
            `FT-${transactionId.slice(0, 8)}`,
            creatorUserId,
          ],
        );
        expect(
          (
            await left.query(
              `UPDATE finance_transactions
               SET status = 'SUBMITTED', "submittedByUserId" = $3, "submittedAt" = NOW(), version = 1
               WHERE id = $1 AND "companyId" = $2 AND version = 0 AND status = 'DRAFT'`,
              [transactionId, fixture.companyId, creatorUserId],
            )
          ).rowCount,
        ).toBe(1);
        expect(
          (
            await left.query(
              `UPDATE finance_transactions
               SET status = 'APPROVED', "approvedByUserId" = $3, "approvedAt" = NOW(), version = 2
               WHERE id = $1 AND "companyId" = $2 AND version = 1 AND status = 'SUBMITTED'`,
              [transactionId, fixture.companyId, approverUserId],
            )
          ).rowCount,
        ).toBe(1);
        expect(
          (
            await left.query(
              `UPDATE finance_transactions
               SET status = 'APPROVED', version = 2
               WHERE id = $1 AND "companyId" = $2 AND version = 1 AND status = 'SUBMITTED'`,
              [transactionId, fixture.companyId],
            )
          ).rowCount,
        ).toBe(0);
        await expectFailureInSavepoint(
          left,
          () =>
            left.query(
              `UPDATE finance_transactions SET description = 'must fail' WHERE id = $1`,
              [transactionId],
            ),
          /FINANCE_HISTORY_IMMUTABLE/,
        );

        await left.query(
          `INSERT INTO finance_transactions (
             id, "companyId", "transactionNumber", "transactionDate", "transactionType",
             status, amount, "currencyCode", description, "sourceType", "reversalOfTransactionId",
             "createdByUserId", "approvedByUserId", "approvedAt", "reversedByUserId", "reversedAt",
             "reverseReason", version, "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, DATE '2097-09-01', 'EXPENSE', 'APPROVED', 1.00, 'INR', 'reversal row',
             'REVERSAL', $4, $5, $5, NOW(), $5, NOW(), 'test reversal', 0, NOW(), NOW())`,
          [
            reversalId,
            fixture.companyId,
            `FT-${reversalId.slice(0, 8)}`,
            transactionId,
            approverUserId,
          ],
        );
        const reverseCas = await left.query(
          `UPDATE finance_transactions
           SET status = 'REVERSED', "reversedByTransactionId" = $3, version = 3
           WHERE id = $1 AND "companyId" = $2 AND version = 2 AND status = 'APPROVED'`,
          [transactionId, fixture.companyId, reversalId],
        );
        expect(reverseCas.rowCount).toBe(1);
        const duplicateReverse = await left.query(
          `UPDATE finance_transactions
           SET status = 'REVERSED', "reversedByTransactionId" = $3, version = 3
           WHERE id = $1 AND "companyId" = $2 AND version = 2 AND status = 'APPROVED'`,
          [transactionId, fixture.companyId, reversalId],
        );
        expect(duplicateReverse.rowCount).toBe(0);

        const calculatedRunId = randomUUID();
        await left.query(
          `INSERT INTO "PayrollRun" (
             id, "companyId", "payrollYear", "payrollMonth", status, "statusEnum", version,
             "createdByUserId", "createdAt", "updatedAt"
           ) VALUES ($1, $2, 2097, 8, 'DRAFT', 'DRAFT', 0, $3, NOW(), NOW())`,
          [calculatedRunId, fixture.companyId, creatorUserId],
        );
        const calculateCas = await left.query(
          `UPDATE "PayrollRun"
           SET status = 'CALCULATED', "statusEnum" = 'CALCULATED', version = 1,
               "calculatedByUserId" = $3, "calculatedAt" = NOW(),
               "totalEarnings" = 1.00, "totalDeductions" = 0.00, "totalNet" = 1.00
           WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'DRAFT'`,
          [calculatedRunId, fixture.companyId, calculatorUserId],
        );
        expect(calculateCas.rowCount).toBe(1);
        expect(
          (
            await left.query(
              `UPDATE "PayrollRun" SET version = 1
               WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'DRAFT'`,
              [calculatedRunId, fixture.companyId],
            )
          ).rowCount,
        ).toBe(0);
        const approveCas = await left.query(
          `UPDATE "PayrollRun"
           SET status = 'APPROVED', "statusEnum" = 'APPROVED', version = 2,
               "approvedByUserId" = $3, "approvedAt" = NOW()
           WHERE id = $1 AND "companyId" = $2 AND version = 1 AND "statusEnum" = 'CALCULATED'`,
          [calculatedRunId, fixture.companyId, approverUserId],
        );
        expect(approveCas.rowCount).toBe(1);
        expect(
          (
            await left.query(
              `UPDATE "PayrollRun" SET status = 'APPROVED', "statusEnum" = 'APPROVED', version = 2
               WHERE id = $1 AND "companyId" = $2 AND version = 1 AND "statusEnum" = 'CALCULATED'`,
              [calculatedRunId, fixture.companyId],
            )
          ).rowCount,
        ).toBe(0);
        const cancelCas = await left.query(
          `UPDATE "PayrollRun"
           SET status = 'CANCELLED', "statusEnum" = 'CANCELLED', version = 3,
               "cancelledByUserId" = $3, "cancelledAt" = NOW(), "cancellationReason" = 'test'
           WHERE id = $1 AND "companyId" = $2 AND version = 2 AND "statusEnum" = 'APPROVED'`,
          [calculatedRunId, fixture.companyId, approverUserId],
        );
        expect(cancelCas.rowCount).toBe(1);
        expect(
          (
            await left.query(
              `UPDATE "PayrollRun" SET version = 3
               WHERE id = $1 AND "companyId" = $2 AND version = 2 AND "statusEnum" = 'APPROVED'`,
              [calculatedRunId, fixture.companyId],
            )
          ).rowCount,
        ).toBe(0);

        const paidRunId = randomUUID();
        await left.query(
          `INSERT INTO "PayrollRun" (
             id, "companyId", "payrollYear", "payrollMonth", status, "statusEnum", version,
             "createdByUserId", "calculatedByUserId", "calculatedAt", "approvedByUserId", "approvedAt",
             "totalEarnings", "totalDeductions", "totalNet", "createdAt", "updatedAt"
           ) VALUES ($1, $2, 2097, 7, 'APPROVED', 'APPROVED', 0, $3, $4, NOW(), $5, NOW(),
             1.00, 0.00, 1.00, NOW(), NOW())`,
          [
            paidRunId,
            fixture.companyId,
            creatorUserId,
            calculatorUserId,
            approverUserId,
          ],
        );
        const paidCas = await left.query(
          `UPDATE "PayrollRun"
           SET status = 'PAID', "statusEnum" = 'PAID', version = 1,
               "paidByUserId" = $3, "paidAt" = NOW(), "paymentReference" = 'test payment'
           WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'APPROVED'`,
          [paidRunId, fixture.companyId, approverUserId],
        );
        expect(paidCas.rowCount).toBe(1);
        expect(
          (
            await left.query(
              `UPDATE "PayrollRun" SET version = 1
               WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'APPROVED'`,
              [paidRunId, fixture.companyId],
            )
          ).rowCount,
        ).toBe(0);
      } finally {
        await left.query('ROLLBACK');
      }
    });
  });

  it('enforces locked-period, opening-date, and opening-balance Finance backstops', async () => {
    await withTwoClients(async (left) => {
      await left.query('BEGIN');
      try {
        const fixture = await createTenantFixture(left, 'FINBACKSTOP', 2);
        const [creatorUserId, approverUserId] = fixture.userIds;
        const accountId = randomUUID();
        await left.query(
          `INSERT INTO finance_payment_accounts (
             id, "companyId", "accountCode", "accountName", "accountType", "currencyCode",
             "openingBalance", "openingDate", "createdByUserId", "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, 'Concurrency cash', 'CASH', 'INR', 0.00, DATE '2097-01-15', $4, NOW(), NOW())`,
          [
            accountId,
            fixture.companyId,
            `CASH-${accountId.slice(0, 8)}`,
            creatorUserId,
          ],
        );
        await left.query(
          `INSERT INTO finance_periods (
             id, "companyId", "periodYear", "periodMonth", "periodStart", "periodEnd",
             status, version, "createdByUserId", "createdAt", "updatedAt"
           ) VALUES ($1, $2, 2097, 2, DATE '2097-02-01', DATE '2097-02-28', 'LOCKED', 0, $3, NOW(), NOW())`,
          [randomUUID(), fixture.companyId, creatorUserId],
        );
        await expectFailureInSavepoint(
          left,
          () =>
            left.query(
              `INSERT INTO finance_transactions (
                 id, "companyId", "transactionNumber", "transactionDate", "transactionType",
                 status, amount, "currencyCode", description, "createdByUserId", "createdAt", "updatedAt"
               ) VALUES ($1, $2, $3, DATE '2097-02-01', 'EXPENSE', 'DRAFT', 1.00, 'INR', 'locked period', $4, NOW(), NOW())`,
              [
                randomUUID(),
                fixture.companyId,
                `FT-${randomUUID().slice(0, 8)}`,
                creatorUserId,
              ],
            ),
          /FINANCE_PERIOD_LOCKED/,
        );
        await expectFailureInSavepoint(
          left,
          () =>
            left.query(
              `INSERT INTO finance_transactions (
                 id, "companyId", "transactionNumber", "transactionDate", "transactionType",
                 status, amount, "currencyCode", "sourceAccountId", description, "createdByUserId", "createdAt", "updatedAt"
               ) VALUES ($1, $2, $3, DATE '2097-01-01', 'EXPENSE', 'DRAFT', 1.00, 'INR', $4, 'before opening', $5, NOW(), NOW())`,
              [
                randomUUID(),
                fixture.companyId,
                `FT-${randomUUID().slice(0, 8)}`,
                accountId,
                creatorUserId,
              ],
            ),
          /FINANCE_ACCOUNT_OPENING_DATE_VIOLATION/,
        );

        await left.query(
          `INSERT INTO finance_transactions (
             id, "companyId", "transactionNumber", "transactionDate", "transactionType",
             status, amount, "currencyCode", "sourceAccountId", description,
             "createdByUserId", "approvedByUserId", "approvedAt", "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, DATE '2097-01-15', 'EXPENSE', 'APPROVED', 1.00, 'INR', $4, 'opening movement',
             $5, $6, NOW(), NOW(), NOW())`,
          [
            randomUUID(),
            fixture.companyId,
            `FT-${randomUUID().slice(0, 8)}`,
            accountId,
            creatorUserId,
            approverUserId,
          ],
        );
        await expectFailureInSavepoint(
          left,
          () =>
            left.query(
              `UPDATE finance_payment_accounts SET "openingDate" = DATE '2097-01-16' WHERE id = $1`,
              [accountId],
            ),
          /FINANCE_OPENING_BALANCE_LOCKED/,
        );
      } finally {
        await left.query('ROLLBACK');
      }
    });
  });

  it('fences a draft adjustment mutation and a duplicate payroll expense behind competing run CAS claims', async () => {
    await withTwoClients(async (left, right) => {
      let fixture: PayrollFixture | undefined;
      try {
        fixture = await createPayrollFixture(left, 'PAYCAS');
        const [userId] = fixture.userIds;
        const adjustmentRunId = randomUUID();
        const expenseRunId = randomUUID();
        await left.query(
          `INSERT INTO "PayrollRun" (
             id, "companyId", "payrollYear", "payrollMonth", status, "statusEnum", version, "createdAt", "updatedAt"
           ) VALUES
             ($1, $2, 2097, 6, 'DRAFT', 'DRAFT', 0, NOW(), NOW()),
             ($3, $2, 2097, 5, 'DRAFT', 'DRAFT', 0, NOW(), NOW())`,
          [adjustmentRunId, fixture.companyId, expenseRunId],
        );

        const adjustmentId = randomUUID();
        const adjustmentMutation = `
          WITH claimed AS (
            UPDATE "PayrollRun"
            SET version = version + 1, "updatedAt" = NOW()
            WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'DRAFT'
            RETURNING id
          )
          INSERT INTO "PayrollRunAdjustment" (
            id, "companyId", "payrollRunId", "employeeId", direction, "sourceType",
            amount, reason, "createdByUserId", "createdAt", "updatedAt"
          )
          SELECT $3, $2, id, $4, 'EARNING', 'MANUAL_ADJUSTMENT', 1.00, 'concurrent', $5, NOW(), NOW()
          FROM claimed
        `;
        const calculateClaim = `
          UPDATE "PayrollRun"
          SET status = 'CALCULATED', "statusEnum" = 'CALCULATED', version = version + 1,
              "totalEarnings" = 0.00, "totalDeductions" = 0.00, "totalNet" = 0.00, "updatedAt" = NOW()
          WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'DRAFT'
        `;
        const [adjustmentResult, calculateResult] = await Promise.all([
          left.query(adjustmentMutation, [
            adjustmentRunId,
            fixture.companyId,
            adjustmentId,
            fixture.employeeId,
            userId,
          ]),
          right.query(calculateClaim, [adjustmentRunId, fixture.companyId]),
        ]);
        expect(
          Number(adjustmentResult.rowCount === 1) +
            Number(calculateResult.rowCount === 1),
        ).toBe(1);

        const expenseInsert = `
          WITH claimed AS (
            UPDATE "PayrollRun"
            SET version = version + 1, "updatedAt" = NOW()
            WHERE id = $1 AND "companyId" = $2 AND version = 0 AND "statusEnum" = 'DRAFT'
            RETURNING id
          )
          INSERT INTO finance_transactions (
            id, "companyId", "transactionNumber", "transactionDate", "transactionType",
            status, amount, "currencyCode", description, "sourceType", "sourceId",
            "createdByUserId", version, "createdAt", "updatedAt"
          )
          SELECT $3, $2, $4, DATE '2097-05-01', 'EXPENSE', 'DRAFT', 1.00, 'INR',
            'payroll expense duplicate claim', 'PAYROLL_RUN', id, $5, 0, NOW(), NOW()
          FROM claimed
        `;
        const [firstExpense, secondExpense] = await Promise.all([
          left.query(expenseInsert, [
            expenseRunId,
            fixture.companyId,
            randomUUID(),
            `FT-${randomUUID().slice(0, 8)}`,
            userId,
          ]),
          right.query(expenseInsert, [
            expenseRunId,
            fixture.companyId,
            randomUUID(),
            `FT-${randomUUID().slice(0, 8)}`,
            userId,
          ]),
        ]);
        expect(
          Number(firstExpense.rowCount === 1) +
            Number(secondExpense.rowCount === 1),
        ).toBe(1);
        const expenses = await left.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM finance_transactions
           WHERE "companyId" = $1 AND "sourceType" = 'PAYROLL_RUN' AND "sourceId" = $2`,
          [fixture.companyId, expenseRunId],
        );
        expect(expenses.rows[0]?.count).toBe('1');
      } finally {
        if (fixture) await cleanupFixture(left, fixture);
      }
    });
  });

  it('allows one payslip per run employee and lets only one worker claim or reclaim an expired lease', async () => {
    await withTwoClients(async (left, right) => {
      let fixture: PayrollFixture | undefined;
      try {
        fixture = await createPayrollFixture(left, 'PAYSLIP');
        const firstRunId = randomUUID();
        const secondRunId = randomUUID();
        const firstRunEmployeeId = randomUUID();
        const secondRunEmployeeId = randomUUID();
        const leasedPayslipId = randomUUID();
        await left.query(
          `INSERT INTO "PayrollRun" (
             id, "companyId", "payrollYear", "payrollMonth", status, "statusEnum", version, "createdAt", "updatedAt"
           ) VALUES
             ($1, $2, 2097, 4, 'DRAFT', 'DRAFT', 0, NOW(), NOW()),
             ($3, $2, 2097, 3, 'DRAFT', 'DRAFT', 0, NOW(), NOW())`,
          [firstRunId, fixture.companyId, secondRunId],
        );
        await left.query(
          `INSERT INTO "PayrollRunEmployee" (
             id, "companyId", "payrollRunId", "branchId", "employeeId", "employeeCode", "displayName",
             "payrollYear", "payrollMonth", "grossEarnings", "netSalary", "createdAt", "updatedAt"
           ) VALUES
             ($1, $2, $3, $4, $5, 'PAYSLIP-ONE', 'Concurrent Employee', 2097, 4, 1.00, 1.00, NOW(), NOW()),
             ($6, $2, $7, $4, $5, 'PAYSLIP-TWO', 'Concurrent Employee', 2097, 3, 1.00, 1.00, NOW(), NOW())`,
          [
            firstRunEmployeeId,
            fixture.companyId,
            firstRunId,
            fixture.branchId,
            fixture.employeeId,
            secondRunEmployeeId,
            secondRunId,
          ],
        );
        const duplicatePayslipSql = `
          INSERT INTO "PayrollPayslip" (
            id, "companyId", "payrollRunId", "payrollRunEmployeeId", "employeeId", "employeeCode", "displayName",
            "payrollYear", "payrollMonth", status, version, "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, 'PAYSLIP-ONE', 'Concurrent Employee', 2097, 4, 'PENDING', 0, NOW(), NOW())
        `;
        const duplicateResults = await Promise.allSettled([
          left.query(duplicatePayslipSql, [
            randomUUID(),
            fixture.companyId,
            firstRunId,
            firstRunEmployeeId,
            fixture.employeeId,
          ]),
          right.query(duplicatePayslipSql, [
            randomUUID(),
            fixture.companyId,
            firstRunId,
            firstRunEmployeeId,
            fixture.employeeId,
          ]),
        ]);
        expect(
          duplicateResults.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          duplicateResults.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);

        await left.query(
          `INSERT INTO "PayrollPayslip" (
             id, "companyId", "payrollRunId", "payrollRunEmployeeId", "employeeId", "employeeCode", "displayName",
             "payrollYear", "payrollMonth", status, version, "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, $4, $5, 'PAYSLIP-TWO', 'Concurrent Employee', 2097, 3, 'PENDING', 0, NOW(), NOW())`,
          [
            leasedPayslipId,
            fixture.companyId,
            secondRunId,
            secondRunEmployeeId,
            fixture.employeeId,
          ],
        );
        const claimSql = `
          UPDATE "PayrollPayslip"
          SET status = 'GENERATING', "generationLeaseId" = $3,
              "generationLeaseExpiresAt" = NOW() + INTERVAL '10 minutes',
              "generationAttemptCount" = "generationAttemptCount" + 1,
              "lastAttemptAt" = NOW(), version = version + 1, "updatedAt" = NOW()
          WHERE id = $1 AND "companyId" = $2 AND "fileObjectId" IS NULL
            AND (
              status IN ('PENDING', 'FAILED') OR
              (status = 'GENERATING' AND ("generationLeaseExpiresAt" IS NULL OR "generationLeaseExpiresAt" < NOW()))
            )
        `;
        const firstLeaseId = randomUUID();
        const [leftClaim, rightClaim] = await Promise.all([
          left.query(claimSql, [
            leasedPayslipId,
            fixture.companyId,
            firstLeaseId,
          ]),
          right.query(claimSql, [
            leasedPayslipId,
            fixture.companyId,
            randomUUID(),
          ]),
        ]);
        expect(
          Number(leftClaim.rowCount === 1) + Number(rightClaim.rowCount === 1),
        ).toBe(1);
        await left.query(
          `UPDATE "PayrollPayslip"
           SET "generationLeaseExpiresAt" = NOW() - INTERVAL '1 second'
           WHERE id = $1`,
          [leasedPayslipId],
        );
        const reclaimLeaseId = randomUUID();
        expect(
          (
            await right.query(claimSql, [
              leasedPayslipId,
              fixture.companyId,
              reclaimLeaseId,
            ])
          ).rowCount,
        ).toBe(1);
        const claimed = await left.query<{
          leaseId: string;
          attempts: number;
          version: number;
        }>(
          `SELECT "generationLeaseId" AS "leaseId", "generationAttemptCount" AS attempts, version
           FROM "PayrollPayslip" WHERE id = $1`,
          [leasedPayslipId],
        );
        expect(claimed.rows[0]).toMatchObject({
          leaseId: reclaimLeaseId,
          attempts: 2,
          version: 2,
        });
      } finally {
        if (fixture) await cleanupFixture(left, fixture);
      }
    });
  });

  it('keeps the uploaded file intent durable while a failed database transaction removes its file record', async () => {
    await withTwoClients(async (left) => {
      let fixture: TenantFixture | undefined;
      try {
        fixture = await createTenantFixture(left, 'FILEINTENT');
        const intentId = randomUUID();
        const fileObjectId = randomUUID();
        const objectKey = `concurrency/clean/${fileObjectId}.pdf`;
        await left.query(
          `INSERT INTO "GeneratedFileIntent" (
             id, "companyId", "objectKey", purpose, status, "correlationId", "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, 'PAYROLL_PAYSLIP', 'UPLOADED', $4, NOW(), NOW())`,
          [intentId, fixture.companyId, objectKey, randomUUID()],
        );

        await left.query('BEGIN');
        try {
          await left.query(
            `INSERT INTO file_objects (
               id, "companyId", "storageProfileCode", "objectKey", status,
               "originalFileNameEncrypted", "fileNameEncKeyVersion", "safeExtension", "declaredMimeType",
               "detectedMimeType", "expectedSizeBytes", "actualSizeBytes", "expectedChecksumSha256",
               "actualChecksumSha256", "clamAvResult", "scannedAt", "createdAt", "updatedAt"
             ) VALUES ($1, $2, 'default', $3, 'CLEAN', 'encrypted-name', 'test-key', 'pdf', 'application/pdf',
               'application/pdf', 1, 1, $4, $4, 'CLEAN', NOW(), NOW(), NOW())`,
            [fileObjectId, fixture.companyId, objectKey, 'a'.repeat(64)],
          );
          await left.query(
            `UPDATE "GeneratedFileIntent" SET status = 'FINALIZED', "updatedAt" = NOW() WHERE id = $1`,
            [intentId],
          );
        } finally {
          await left.query('ROLLBACK');
        }

        const intent = await left.query<{ status: string }>(
          `SELECT status FROM "GeneratedFileIntent" WHERE id = $1`,
          [intentId],
        );
        const files = await left.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM file_objects WHERE id = $1`,
          [fileObjectId],
        );
        expect(intent.rows[0]?.status).toBe('UPLOADED');
        expect(files.rows[0]?.count).toBe('0');
      } finally {
        if (fixture) await cleanupFixture(left, fixture);
      }
    });
  });
});
