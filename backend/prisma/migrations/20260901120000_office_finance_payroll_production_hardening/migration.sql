-- Office Finance / Payroll production hardening. Additive migration.
-- Do not apply to a shared database without the separately approved HR migration.

INSERT INTO permissions(id, code, name, description, "isTenantAssignable", "createdAt", "updatedAt")
VALUES (
  md5('permission:finance.transactions.reverse'),
  'finance.transactions.reverse',
  'Reverse finance transactions',
  'Reverse an approved manual Office Finance transaction with evidence',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "isTenantAssignable" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'finance.transactions.reverse'),
    ('COMPANY_ADMINISTRATOR', 'finance.transactions.reverse'),
    ('FINANCE_MANAGER', 'finance.transactions.reverse')
)
INSERT INTO role_permissions(id, "roleId", "permissionId")
SELECT md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"), r.id, p.id
FROM mappings m
JOIN roles r ON r.code = m."roleCode" AND r."isActive" = true
JOIN permissions p ON p.code = m."permissionCode"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM finance_transactions t
    LEFT JOIN finance_payment_accounts sa
      ON sa."companyId" = t."companyId" AND sa.id = t."sourceAccountId"
    LEFT JOIN finance_payment_accounts da
      ON da."companyId" = t."companyId" AND da.id = t."destinationAccountId"
    WHERE (sa.id IS NOT NULL AND t."transactionDate" < sa."openingDate")
       OR (da.id IS NOT NULL AND t."transactionDate" < da."openingDate")
  ) THEN
    RAISE EXCEPTION 'FINANCE_ACCOUNT_OPENING_DATE_RECONCILIATION_REQUIRED';
  END IF;
END $$;

WITH derived AS (
  SELECT t.id,
    CASE
      WHEN t."transactionType"::text = 'TRANSFER'
       AND sa."branchId" IS NOT NULL AND da."branchId" IS NOT NULL
       AND sa."branchId" <> da."branchId" THEN NULL
      WHEN cardinality(ARRAY(
        SELECT DISTINCT x FROM unnest(ARRAY[
          sa."branchId", da."branchId", d."branchId", p."branchId", e."branchId"
        ]) x WHERE x IS NOT NULL
      )) <= 1 THEN (
        SELECT x FROM unnest(ARRAY[
          sa."branchId", da."branchId", d."branchId", p."branchId", e."branchId"
        ]) x WHERE x IS NOT NULL LIMIT 1
      )
      ELSE t."branchId"
    END AS "derivedBranchId",
    cardinality(ARRAY(
      SELECT DISTINCT x FROM unnest(ARRAY[
        sa."branchId", da."branchId", d."branchId", p."branchId", e."branchId"
      ]) x WHERE x IS NOT NULL
    )) AS branch_count
  FROM finance_transactions t
  LEFT JOIN finance_payment_accounts sa ON sa."companyId" = t."companyId" AND sa.id = t."sourceAccountId"
  LEFT JOIN finance_payment_accounts da ON da."companyId" = t."companyId" AND da.id = t."destinationAccountId"
  LEFT JOIN departments d ON d."companyId" = t."companyId" AND d.id = t."departmentId"
  LEFT JOIN projects p ON p."companyId" = t."companyId" AND p.id = t."projectId"
  LEFT JOIN employees e ON e."companyId" = t."companyId" AND e.id = t."employeeId"
)
UPDATE finance_transactions t SET "branchId" = d."derivedBranchId"
FROM derived d
WHERE t.id = d.id
  AND (d.branch_count <= 1 OR t."transactionType"::text = 'TRANSFER')
  AND t."branchId" IS DISTINCT FROM d."derivedBranchId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM finance_transactions t
    LEFT JOIN finance_payment_accounts sa ON sa."companyId" = t."companyId" AND sa.id = t."sourceAccountId"
    LEFT JOIN finance_payment_accounts da ON da."companyId" = t."companyId" AND da.id = t."destinationAccountId"
    LEFT JOIN departments d ON d."companyId" = t."companyId" AND d.id = t."departmentId"
    LEFT JOIN projects p ON p."companyId" = t."companyId" AND p.id = t."projectId"
    LEFT JOIN employees e ON e."companyId" = t."companyId" AND e.id = t."employeeId"
    WHERE t."transactionType"::text <> 'TRANSFER'
      AND cardinality(ARRAY(
        SELECT DISTINCT x FROM unnest(ARRAY[
          sa."branchId", da."branchId", d."branchId", p."branchId", e."branchId"
        ]) x WHERE x IS NOT NULL
      )) > 1
  ) THEN
    RAISE EXCEPTION 'FINANCE_BRANCH_RECONCILIATION_REQUIRED';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION finance_transaction_scope_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_branch text;
  destination_branch text;
  department_branch text;
  project_branch text;
  employee_branch text;
  source_opening date;
  destination_opening date;
  branches text[];
BEGIN
  IF NEW."sourceAccountId" IS NOT NULL THEN
    SELECT "branchId", "openingDate" INTO source_branch, source_opening
    FROM finance_payment_accounts
    WHERE id = NEW."sourceAccountId" AND "companyId" = NEW."companyId";
  END IF;
  IF NEW."destinationAccountId" IS NOT NULL THEN
    SELECT "branchId", "openingDate" INTO destination_branch, destination_opening
    FROM finance_payment_accounts
    WHERE id = NEW."destinationAccountId" AND "companyId" = NEW."companyId";
  END IF;
  IF source_opening IS NOT NULL AND NEW."transactionDate" < source_opening THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FINANCE_ACCOUNT_OPENING_DATE_VIOLATION';
  END IF;
  IF destination_opening IS NOT NULL AND NEW."transactionDate" < destination_opening THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FINANCE_ACCOUNT_OPENING_DATE_VIOLATION';
  END IF;

  SELECT "branchId" INTO department_branch FROM departments
    WHERE id = NEW."departmentId" AND "companyId" = NEW."companyId";
  SELECT "branchId" INTO project_branch FROM projects
    WHERE id = NEW."projectId" AND "companyId" = NEW."companyId";
  SELECT "branchId" INTO employee_branch FROM employees
    WHERE id = NEW."employeeId" AND "companyId" = NEW."companyId";

  IF NEW."transactionType"::text = 'TRANSFER'
     AND source_branch IS NOT NULL AND destination_branch IS NOT NULL
     AND source_branch <> destination_branch THEN
    NEW."branchId" := NULL;
    RETURN NEW;
  END IF;

  SELECT ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[
    source_branch, destination_branch, department_branch, project_branch, employee_branch
  ]) x WHERE x IS NOT NULL) INTO branches;
  IF cardinality(branches) > 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FINANCE_BRANCH_SCOPE_MISMATCH';
  END IF;
  NEW."branchId" := CASE WHEN cardinality(branches) = 1 THEN branches[1] ELSE NULL END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_finance_transaction_scope_guard ON finance_transactions;
CREATE TRIGGER trg_finance_transaction_scope_guard
BEFORE INSERT OR UPDATE ON finance_transactions
FOR EACH ROW EXECUTE FUNCTION finance_transaction_scope_guard();

CREATE INDEX IF NOT EXISTS finance_transactions_company_branch_date_status_idx
  ON finance_transactions("companyId", "branchId", "transactionDate", status);
CREATE INDEX IF NOT EXISTS payroll_payslips_operations_queue_idx
  ON "PayrollPayslip"("companyId", status, "failureCode", "updatedAt");
CREATE INDEX IF NOT EXISTS payroll_payslips_expired_lease_idx
  ON "PayrollPayslip"(status, "generationLeaseExpiresAt")
  WHERE status = 'GENERATING';
CREATE INDEX IF NOT EXISTS generated_file_intents_reconcile_queue_idx
  ON "GeneratedFileIntent"(status, "updatedAt", "companyId");
