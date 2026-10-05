import { withOfficeFinancePayrollClient } from './office-finance-payroll-db';
import type { PoolClient } from 'pg';

type Finding = { code: string; count: number; sampleIds: string[] };

async function collect(
  client: PoolClient,
  code: string,
  sql: string,
): Promise<Finding> {
  try {
    const result = await client.query<{ id: string }>(sql);
    return {
      code,
      count: result.rows.length,
      sampleIds: result.rows.slice(0, 20).map((row) => row.id),
    };
  } catch (error) {
    return {
      code: `${code}_QUERY_FAILED`,
      count: 1,
      sampleIds: [
        error instanceof Error ? error.message.slice(0, 180) : 'query failed',
      ],
    };
  }
}

async function main() {
  await withOfficeFinancePayrollClient(async (client) => {
    const findings: Finding[] = [];

    findings.push(
      await collect(
        client,
        'FINANCE_BANK_BASE64_ONLY',
        `SELECT id FROM finance_payment_accounts
         WHERE "bankReferenceEncrypted" IS NOT NULL
           AND ("bankReferenceEncNonce" IS NULL OR "bankReferenceEncTag" IS NULL
                OR "bankReferenceEncKeyVersion" IS NULL OR "bankLastFour" IS NULL)`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_BANK_ENVELOPE_INCOMPLETE',
        `SELECT id FROM finance_payment_accounts
         WHERE ("bankReferenceEncrypted" IS NOT NULL)
            <> ("bankReferenceEncNonce" IS NOT NULL AND "bankReferenceEncTag" IS NOT NULL
               AND "bankReferenceEncKeyVersion" IS NOT NULL AND "bankLastFour" IS NOT NULL)`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_ACCOUNT_CURRENCY_MISMATCH',
        `SELECT a.id
         FROM finance_payment_accounts a
         JOIN company_financial_profiles p ON a."companyId" = p."companyId"
         WHERE a."currencyCode" IS DISTINCT FROM p."baseCurrencyCode"`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_INVALID_SUBMITTED_OR_APPROVED_SHAPE',
        `SELECT id FROM finance_transactions
         WHERE "status" IN ('SUBMITTED', 'APPROVED', 'REVERSED')
           AND (
             ("transactionType" = 'INCOME' AND ("categoryId" IS NULL OR "destinationAccountId" IS NULL OR "sourceAccountId" IS NOT NULL))
             OR ("transactionType" = 'EXPENSE' AND ("categoryId" IS NULL OR "sourceAccountId" IS NULL OR "destinationAccountId" IS NOT NULL))
             OR ("transactionType" = 'TRANSFER' AND ("sourceAccountId" IS NULL OR "destinationAccountId" IS NULL
                  OR "sourceAccountId" = "destinationAccountId" OR "categoryId" IS NOT NULL))
           )`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_SELF_APPROVED_NON_REVERSAL',
        `SELECT id FROM finance_transactions
         WHERE "status" IN ('APPROVED', 'REVERSED')
           AND "createdByUserId" = "approvedByUserId"
           AND "sourceType" IS DISTINCT FROM 'REVERSAL'`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_ORPHAN_OR_DUPLICATE_REVERSAL',
        `SELECT COALESCE(r.id, o.id) AS id
         FROM finance_transactions r
         FULL OUTER JOIN finance_transactions o
           ON r."reversalOfTransactionId" = o.id AND r."companyId" = o."companyId"
         WHERE r."sourceType" = 'REVERSAL'
           AND (o.id IS NULL OR o."companyId" IS DISTINCT FROM r."companyId")
         UNION ALL
         SELECT MIN(id) AS id
         FROM finance_transactions
         WHERE "sourceType" = 'REVERSAL' AND "reversalOfTransactionId" IS NOT NULL
         GROUP BY "companyId", "reversalOfTransactionId"
         HAVING COUNT(*) > 1`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_APPROVED_MISSING_EVIDENCE',
        `SELECT id FROM finance_transactions
         WHERE ("status" = 'APPROVED' AND ("approvedByUserId" IS NULL OR "approvedAt" IS NULL))
            OR ("status" = 'REVERSED' AND ("reversedByUserId" IS NULL OR "reversedAt" IS NULL))`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_TRANSACTION_PERIOD_MISMATCH',
        `SELECT t.id
         FROM finance_transactions t
         LEFT JOIN finance_periods p
           ON p."companyId" = t."companyId"
          AND t."transactionDate" >= p."periodStart"
          AND t."transactionDate" <= p."periodEnd"
         WHERE t."status" IN ('SUBMITTED', 'APPROVED', 'REVERSED')
           AND (p.id IS NULL OR p."status" = 'LOCKED')`,
      ),
    );
    findings.push(
      await collect(
        client,
        'FINANCE_ATTACHMENT_COMPANY_MISMATCH',
        `SELECT a.id
         FROM finance_transaction_attachments a
         JOIN finance_transactions t ON t.id = a."financeTransactionId"
         LEFT JOIN file_objects f ON f.id = a."fileObjectId"
         WHERE a."companyId" IS DISTINCT FROM t."companyId"
            OR f.id IS NULL
            OR f."companyId" IS DISTINCT FROM a."companyId"`,
      ),
    );

    findings.push(
      await collect(
        client,
        'PAYROLL_DUPLICATE_ACTIVE_PERIOD',
        `SELECT MIN(id) AS id FROM "PayrollRun"
         WHERE "statusEnum" IS DISTINCT FROM 'CANCELLED'
         GROUP BY "companyId", "payrollYear", "payrollMonth"
         HAVING COUNT(*) > 1`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_UNKNOWN_OR_MISSING_STATUS',
        `SELECT id FROM "PayrollRun"
         WHERE "statusEnum" IS NULL
            OR "statusEnum" NOT IN ('DRAFT','CALCULATED','APPROVED','PAID','CANCELLED','LEGACY_IMPORTED')`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_CROSS_COMPANY_SOURCE',
        `SELECT e.id
         FROM "PayrollRunEmployee" e
         JOIN "PayrollRun" r ON r.id = e."payrollRunId"
         LEFT JOIN "EmployeeSalary" s ON s.id = e."employeeSalaryId"
         WHERE e."companyId" IS DISTINCT FROM r."companyId"
            OR (e."employeeSalaryId" IS NOT NULL AND (s.id IS NULL OR s."companyId" IS DISTINCT FROM e."companyId"
                OR s."employeeId" IS DISTINCT FROM e."employeeId"))`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_LINE_CROSS_SCOPE',
        `SELECT l.id
         FROM "PayrollRunEmployeeLine" l
         JOIN "PayrollRunEmployee" e ON e.id = l."payrollRunEmployeeId"
         LEFT JOIN leave_requests lr ON lr.id = l."leaveRequestId"
         WHERE l."companyId" IS DISTINCT FROM e."companyId"
            OR (l."leaveRequestId" IS NOT NULL AND (lr.id IS NULL OR lr."companyId" IS DISTINCT FROM l."companyId"))`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_TOTAL_DRIFT',
        `SELECT r.id
         FROM "PayrollRun" r
         WHERE r."statusEnum" IN ('CALCULATED','APPROVED','PAID')
           AND (
             COALESCE(r."totalEarnings", 0) <> (
               SELECT COALESCE(SUM(e."grossEarnings"), 0) FROM "PayrollRunEmployee" e WHERE e."payrollRunId" = r.id
             )
             OR COALESCE(r."totalNet", 0) <> (
               SELECT COALESCE(SUM(e."netSalary"), 0) FROM "PayrollRunEmployee" e WHERE e."payrollRunId" = r.id
             )
           )`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_ATTENDANCE_VERSION_MISMATCH',
        `SELECT l.id
         FROM "PayrollRunAttendancePeriod" l
         JOIN attendance_periods p ON p.id = l."attendancePeriodId"
         WHERE l."attendancePeriodVersion" IS DISTINCT FROM p.version
            OR l."companyId" IS DISTINCT FROM p."companyId"`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_SALARY_TAX_RANGE_OVERLAP',
        `SELECT a.id
         FROM "EmployeeSalary" a
         JOIN "EmployeeSalary" b
           ON a."companyId" = b."companyId" AND a."employeeId" = b."employeeId" AND a.id < b.id
          AND daterange(a."effectiveFrom"::date, COALESCE(a."effectiveTo"::date, 'infinity'::date), '[]')
           && daterange(b."effectiveFrom"::date, COALESCE(b."effectiveTo"::date, 'infinity'::date), '[]')
         UNION ALL
         SELECT a.id
         FROM "EmployeeTaxProfile" a
         JOIN "EmployeeTaxProfile" b
           ON a."companyId" = b."companyId" AND a."employeeId" = b."employeeId" AND a.id < b.id
          AND a."archivedAt" IS NULL AND b."archivedAt" IS NULL
          AND a."effectiveFrom" IS NOT NULL AND b."effectiveFrom" IS NOT NULL
          AND daterange(a."effectiveFrom"::date, COALESCE(a."effectiveTo"::date, 'infinity'::date), '[]')
           && daterange(b."effectiveFrom"::date, COALESCE(b."effectiveTo"::date, 'infinity'::date), '[]')`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_PAID_FINANCE_LINK_DRIFT',
        `SELECT r.id FROM "PayrollRun" r
         WHERE r."statusEnum" = 'PAID' AND r."financeTransactionId" IS NULL
         UNION ALL
         SELECT MIN(id) AS id FROM "PayrollRun"
         WHERE "financeTransactionId" IS NOT NULL
         GROUP BY "companyId", "financeTransactionId"
         HAVING COUNT(*) > 1`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYROLL_DUPLICATE_PAYSLIP_OR_FILE',
        `SELECT MIN(id) AS id FROM "PayrollPayslip"
         GROUP BY "companyId", "payrollRunEmployeeId"
         HAVING COUNT(*) > 1
         UNION ALL
         SELECT MIN(id) AS id FROM "PayrollPayslip"
         WHERE "fileObjectId" IS NOT NULL
         GROUP BY "companyId", "fileObjectId"
         HAVING COUNT(*) > 1`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYSLIP_STALE_GENERATING',
        `SELECT id FROM "PayrollPayslip"
         WHERE status = 'GENERATING'
           AND ("generationLeaseExpiresAt" IS NULL OR "generationLeaseExpiresAt" < NOW())`,
      ),
    );
    findings.push(
      await collect(
        client,
        'PAYSLIP_AVAILABLE_WITHOUT_CLEAN_FILE',
        `SELECT p.id
         FROM "PayrollPayslip" p
         LEFT JOIN file_objects f ON f.id = p."fileObjectId" AND f."companyId" = p."companyId"
         WHERE p.status = 'AVAILABLE'
           AND (f.id IS NULL OR f.status IS DISTINCT FROM 'CLEAN')`,
      ),
    );

    const blocking = findings.filter((item) => item.count > 0);
    console.log(
      JSON.stringify({ findings, blocking: blocking.length }, null, 2),
    );
    if (blocking.length > 0) {
      process.exitCode = 1;
    }
  });
}

void main();
