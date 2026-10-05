-- Office Finance + Payroll release contract: reversal exemption, immutability,
-- opening-balance lock, payroll snapshot freeze, partial period uniqueness,
-- company-qualified snapshot FKs, envelope completeness.

-- ============================================================================
-- 1. Maker-checker exemption only for a structurally valid REVERSAL row
-- ============================================================================

CREATE OR REPLACE FUNCTION finance_prevent_self_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'APPROVED'
     AND NEW."approvedByUserId" IS NOT NULL
     AND NEW."createdByUserId" = NEW."approvedByUserId" THEN
    IF NEW."sourceType" = 'REVERSAL'
       AND NEW."reversalOfTransactionId" IS NOT NULL
       AND NEW."reversedByUserId" IS NOT NULL
       AND NEW."reversedAt" IS NOT NULL
       AND COALESCE(BTRIM(NEW."reverseReason"), '') <> '' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'FINANCE_SELF_APPROVAL_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_self_approval ON "finance_transactions";
CREATE TRIGGER finance_transactions_self_approval
  BEFORE INSERT OR UPDATE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_prevent_self_approval();

-- ============================================================================
-- 2. Reversal copy-validation
-- ============================================================================

CREATE OR REPLACE FUNCTION finance_validate_reversal_copy()
RETURNS trigger AS $$
DECLARE
  original "finance_transactions"%ROWTYPE;
BEGIN
  IF NEW."sourceType" <> 'REVERSAL' THEN
    RETURN NEW;
  END IF;

  IF NEW."reversalOfTransactionId" IS NULL
     OR NEW."reversedByUserId" IS NULL
     OR NEW."reversedAt" IS NULL
     OR COALESCE(BTRIM(NEW."reverseReason"), '') = '' THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  SELECT * INTO original
  FROM "finance_transactions"
  WHERE "id" = NEW."reversalOfTransactionId"
    AND "companyId" = NEW."companyId"
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF original."status" NOT IN ('APPROVED', 'REVERSED') THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF original."sourceType" = 'REVERSAL' THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF NEW."amount" IS DISTINCT FROM original."amount"
     OR NEW."taxAmount" IS DISTINCT FROM original."taxAmount"
     OR NEW."currencyCode" IS DISTINCT FROM original."currencyCode"
     OR NEW."transactionType" IS DISTINCT FROM original."transactionType"
     OR NEW."sourceAccountId" IS DISTINCT FROM original."sourceAccountId"
     OR NEW."destinationAccountId" IS DISTINCT FROM original."destinationAccountId"
     OR NEW."categoryId" IS DISTINCT FROM original."categoryId"
     OR NEW."branchId" IS DISTINCT FROM original."branchId"
     OR NEW."departmentId" IS DISTINCT FROM original."departmentId"
     OR NEW."projectId" IS DISTINCT FROM original."projectId"
     OR NEW."businessPartyId" IS DISTINCT FROM original."businessPartyId"
     OR NEW."employeeId" IS DISTINCT FROM original."employeeId" THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_reversal_copy ON "finance_transactions";
CREATE TRIGGER finance_transactions_reversal_copy
  BEFORE INSERT OR UPDATE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_validate_reversal_copy();

-- ============================================================================
-- 3. Strict approved/reversed immutability
-- ============================================================================

CREATE OR REPLACE FUNCTION finance_prevent_approved_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'REVERSED' THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: reversed transactions cannot be edited';
  END IF;

  IF OLD."status" = 'APPROVED' AND OLD."sourceType" = 'REVERSAL' THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved reversal rows cannot be edited';
  END IF;

  IF OLD."status" = 'APPROVED' AND NEW."status" = 'REVERSED' THEN
    IF NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."taxAmount" IS DISTINCT FROM OLD."taxAmount"
       OR NEW."transactionDate" IS DISTINCT FROM OLD."transactionDate"
       OR NEW."transactionType" IS DISTINCT FROM OLD."transactionType"
       OR NEW."categoryId" IS DISTINCT FROM OLD."categoryId"
       OR NEW."sourceAccountId" IS DISTINCT FROM OLD."sourceAccountId"
       OR NEW."destinationAccountId" IS DISTINCT FROM OLD."destinationAccountId"
       OR NEW."businessPartyId" IS DISTINCT FROM OLD."businessPartyId"
       OR NEW."employeeId" IS DISTINCT FROM OLD."employeeId"
       OR NEW."departmentId" IS DISTINCT FROM OLD."departmentId"
       OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
       OR NEW."description" IS DISTINCT FROM OLD."description"
       OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode"
       OR NEW."reference" IS DISTINCT FROM OLD."reference"
       OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType"
       OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId"
       OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
       OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
       OR NEW."approvedByUserId" IS DISTINCT FROM OLD."approvedByUserId"
       OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
       OR NEW."transactionNumber" IS DISTINCT FROM OLD."transactionNumber"
       OR NEW."reversedByTransactionId" IS NULL THEN
      RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved transactions cannot be edited';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" IN ('APPROVED', 'REVERSED') THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved/reversed transactions cannot be edited';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_prevent_update ON "finance_transactions";
CREATE TRIGGER finance_transactions_prevent_update
  BEFORE UPDATE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_prevent_approved_update();

-- ============================================================================
-- 4. Opening-balance lock with account-scoped advisory lock
-- ============================================================================

CREATE OR REPLACE FUNCTION finance_prevent_opening_balance_change()
RETURNS trigger AS $$
DECLARE
  movement_count integer;
BEGIN
  IF NEW."openingBalance" IS DISTINCT FROM OLD."openingBalance"
     OR NEW."openingDate" IS DISTINCT FROM OLD."openingDate"
     OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode" THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD."id", 0));
    PERFORM 1 FROM "finance_payment_accounts" WHERE "id" = OLD."id" FOR UPDATE;

    SELECT COUNT(*) INTO movement_count
    FROM "finance_transactions" t
    WHERE t."companyId" = OLD."companyId"
      AND t."status" IN ('APPROVED', 'REVERSED')
      AND (t."sourceAccountId" = OLD."id" OR t."destinationAccountId" = OLD."id");
    IF movement_count > 0 THEN
      RAISE EXCEPTION 'FINANCE_OPENING_BALANCE_LOCKED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_payment_accounts_opening_balance_lock ON "finance_payment_accounts";
CREATE TRIGGER finance_payment_accounts_opening_balance_lock
  BEFORE UPDATE ON "finance_payment_accounts"
  FOR EACH ROW EXECUTE FUNCTION finance_prevent_opening_balance_change();

-- ============================================================================
-- 5. Bank envelope completeness
-- ============================================================================

ALTER TABLE "finance_payment_accounts"
  DROP CONSTRAINT IF EXISTS finance_payment_accounts_bank_envelope_chk;

ALTER TABLE "finance_payment_accounts"
  ADD CONSTRAINT finance_payment_accounts_bank_envelope_chk
  CHECK (
    (
      "bankReferenceEncrypted" IS NULL
      AND "bankReferenceEncNonce" IS NULL
      AND "bankReferenceEncTag" IS NULL
      AND "bankReferenceEncKeyVersion" IS NULL
      AND "bankReferenceEncFormatVersion" IS NULL
      AND "bankLastFour" IS NULL
    )
    OR (
      "bankReferenceEncrypted" IS NOT NULL
      AND "bankReferenceEncNonce" IS NOT NULL
      AND "bankReferenceEncTag" IS NOT NULL
      AND "bankReferenceEncKeyVersion" IS NOT NULL
      AND "bankReferenceEncFormatVersion" IS NOT NULL
      AND "bankLastFour" IS NOT NULL
    )
  );

-- ============================================================================
-- 6. Payroll period uniqueness: one non-cancelled run per company/year/month
-- ============================================================================

DROP INDEX IF EXISTS "PayrollRun_companyId_payrollYear_payrollMonth_key";

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_companyId_payrollYear_payrollMonth_active_key"
  ON "PayrollRun"("companyId", "payrollYear", "payrollMonth")
  WHERE "statusEnum" IS DISTINCT FROM 'CANCELLED';

-- ============================================================================
-- 7. Payroll run immutability outside documented transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION payroll_prevent_frozen_run_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."statusEnum" IN ('CALCULATED', 'APPROVED', 'PAID', 'LEGACY_IMPORTED') THEN
    IF NEW."payrollYear" IS DISTINCT FROM OLD."payrollYear"
       OR NEW."payrollMonth" IS DISTINCT FROM OLD."payrollMonth"
       OR NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
       OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd"
       OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode"
       OR NEW."runNumber" IS DISTINCT FROM OLD."runNumber"
       OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" THEN
      RAISE EXCEPTION 'PAYROLL_RUN_IMMUTABLE';
    END IF;

    IF OLD."statusEnum" IN ('APPROVED', 'PAID', 'LEGACY_IMPORTED') THEN
      IF NEW."totalEarnings" IS DISTINCT FROM OLD."totalEarnings"
         OR NEW."totalDeductions" IS DISTINCT FROM OLD."totalDeductions"
         OR NEW."totalNet" IS DISTINCT FROM OLD."totalNet"
         OR NEW."calculatedByUserId" IS DISTINCT FROM OLD."calculatedByUserId"
         OR NEW."calculatedAt" IS DISTINCT FROM OLD."calculatedAt" THEN
        RAISE EXCEPTION 'PAYROLL_RUN_IMMUTABLE';
      END IF;
    END IF;

    IF OLD."statusEnum" = 'CALCULATED'
       AND NEW."statusEnum" NOT IN ('CALCULATED', 'APPROVED', 'DRAFT', 'CANCELLED') THEN
      RAISE EXCEPTION 'PAYROLL_RUN_IMMUTABLE';
    END IF;

    IF OLD."statusEnum" = 'APPROVED'
       AND NEW."statusEnum" NOT IN ('APPROVED', 'PAID', 'CANCELLED') THEN
      RAISE EXCEPTION 'PAYROLL_RUN_IMMUTABLE';
    END IF;

    IF OLD."statusEnum" IN ('PAID', 'LEGACY_IMPORTED')
       AND (
         NEW."statusEnum" IS DISTINCT FROM OLD."statusEnum"
         OR NEW."paidByUserId" IS DISTINCT FROM OLD."paidByUserId"
         OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt"
         OR NEW."paymentAccountId" IS DISTINCT FROM OLD."paymentAccountId"
         OR NEW."paymentReference" IS DISTINCT FROM OLD."paymentReference"
         OR NEW."financeTransactionId" IS DISTINCT FROM OLD."financeTransactionId"
       ) THEN
      RAISE EXCEPTION 'PAYROLL_RUN_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_prevent_frozen_update ON "PayrollRun";
CREATE TRIGGER payroll_runs_prevent_frozen_update
  BEFORE UPDATE ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_frozen_run_update();

-- ============================================================================
-- 8. Snapshot freeze while parent run is calculated/approved/paid/legacy
-- ============================================================================

CREATE OR REPLACE FUNCTION payroll_prevent_snapshot_mutation()
RETURNS trigger AS $$
DECLARE
  run_status "PayrollRunStatus";
  run_id TEXT;
BEGIN
  run_id := COALESCE(NEW."payrollRunId", OLD."payrollRunId");
  SELECT r."statusEnum" INTO run_status
  FROM "PayrollRun" r
  WHERE r."id" = run_id
  FOR SHARE;

  IF run_status IN ('CALCULATED', 'APPROVED', 'PAID', 'LEGACY_IMPORTED') THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_run_employees_snapshot_guard ON "PayrollRunEmployee";
CREATE TRIGGER payroll_run_employees_snapshot_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunEmployee"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_snapshot_mutation();

CREATE OR REPLACE FUNCTION payroll_prevent_line_snapshot_mutation()
RETURNS trigger AS $$
DECLARE
  run_status "PayrollRunStatus";
BEGIN
  SELECT r."statusEnum" INTO run_status
  FROM "PayrollRun" r
  JOIN "PayrollRunEmployee" e
    ON r."id" = e."payrollRunId"
  WHERE e."id" = COALESCE(NEW."payrollRunEmployeeId", OLD."payrollRunEmployeeId")
  FOR SHARE;

  IF run_status IN ('CALCULATED', 'APPROVED', 'PAID', 'LEGACY_IMPORTED') THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_run_employee_lines_snapshot_guard ON "PayrollRunEmployeeLine";
CREATE TRIGGER payroll_run_employee_lines_snapshot_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunEmployeeLine"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_line_snapshot_mutation();

CREATE OR REPLACE FUNCTION payroll_prevent_attendance_snapshot_mutation()
RETURNS trigger AS $$
DECLARE
  run_status "PayrollRunStatus";
BEGIN
  SELECT r."statusEnum" INTO run_status
  FROM "PayrollRun" r
  WHERE r."id" = COALESCE(NEW."payrollRunId", OLD."payrollRunId")
  FOR SHARE;

  IF run_status IN ('CALCULATED', 'APPROVED', 'PAID', 'LEGACY_IMPORTED') THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_run_attendance_snapshot_guard ON "PayrollRunAttendancePeriod";
CREATE TRIGGER payroll_run_attendance_snapshot_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunAttendancePeriod"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_attendance_snapshot_mutation();

-- ============================================================================
-- 9. Company-qualified source FKs on payroll snapshot lines
-- ============================================================================

ALTER TABLE "PayrollRunEmployeeLine"
  DROP CONSTRAINT IF EXISTS "PayrollRunEmployeeLine_salaryComponentId_fkey";
ALTER TABLE "PayrollRunEmployeeLine"
  DROP CONSTRAINT IF EXISTS "PayrollRunEmployeeLine_taxProfileId_fkey";
ALTER TABLE "PayrollRunEmployeeLine"
  DROP CONSTRAINT IF EXISTS "PayrollRunEmployeeLine_recurringDeductionId_fkey";
ALTER TABLE "PayrollRunEmployeeLine"
  DROP CONSTRAINT IF EXISTS "PayrollRunEmployeeLine_adjustmentId_fkey";
ALTER TABLE "PayrollRunEmployeeLine"
  DROP CONSTRAINT IF EXISTS "PayrollRunEmployeeLine_overtimeRequestId_fkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRunEmployeeLine_company_salaryComponent_fkey'
  ) THEN
    ALTER TABLE "PayrollRunEmployeeLine"
      ADD CONSTRAINT "PayrollRunEmployeeLine_company_salaryComponent_fkey"
      FOREIGN KEY ("companyId", "salaryComponentId")
      REFERENCES "SalaryComponent"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRunEmployeeLine_company_taxProfile_fkey'
  ) THEN
    ALTER TABLE "PayrollRunEmployeeLine"
      ADD CONSTRAINT "PayrollRunEmployeeLine_company_taxProfile_fkey"
      FOREIGN KEY ("companyId", "taxProfileId")
      REFERENCES "EmployeeTaxProfile"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRunEmployeeLine_company_recurringDeduction_fkey'
  ) THEN
    ALTER TABLE "PayrollRunEmployeeLine"
      ADD CONSTRAINT "PayrollRunEmployeeLine_company_recurringDeduction_fkey"
      FOREIGN KEY ("companyId", "recurringDeductionId")
      REFERENCES "EmployeeDeduction"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRunEmployeeLine_company_adjustment_fkey'
  ) THEN
    ALTER TABLE "PayrollRunEmployeeLine"
      ADD CONSTRAINT "PayrollRunEmployeeLine_company_adjustment_fkey"
      FOREIGN KEY ("companyId", "adjustmentId")
      REFERENCES "PayrollRunAdjustment"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRunEmployeeLine_company_overtimeRequest_fkey'
  ) THEN
    ALTER TABLE "PayrollRunEmployeeLine"
      ADD CONSTRAINT "PayrollRunEmployeeLine_company_overtimeRequest_fkey"
      FOREIGN KEY ("companyId", "overtimeRequestId")
      REFERENCES "overtime_requests"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;
