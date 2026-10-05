-- ERP Lite contract hardening: period lock, opening-balance immutability,
-- finance UPDATE immutability, attendance reopen guard, amount checks.

-- Finance: prevent mutation of core fields on APPROVED/REVERSED rows
CREATE OR REPLACE FUNCTION finance_prevent_approved_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('APPROVED', 'REVERSED') THEN
    -- Allow transition APPROVED -> REVERSED with reversedBy link only
    IF OLD."status" = 'APPROVED'
       AND NEW."status" = 'REVERSED'
       AND NEW."amount" = OLD."amount"
       AND NEW."taxAmount" = OLD."taxAmount"
       AND NEW."transactionDate" = OLD."transactionDate"
       AND NEW."transactionType" = OLD."transactionType"
       AND NEW."categoryId" IS NOT DISTINCT FROM OLD."categoryId"
       AND NEW."sourceAccountId" IS NOT DISTINCT FROM OLD."sourceAccountId"
       AND NEW."destinationAccountId" IS NOT DISTINCT FROM OLD."destinationAccountId"
       AND NEW."description" = OLD."description"
       AND NEW."currencyCode" = OLD."currencyCode"
       AND NEW."reversedByTransactionId" IS NOT NULL THEN
      RETURN NEW;
    END IF;

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
       OR (OLD."status" = 'REVERSED' AND NEW."status" IS DISTINCT FROM OLD."status")
       OR (OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('APPROVED', 'REVERSED')) THEN
      RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved/reversed transactions cannot be edited';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_prevent_update ON "finance_transactions";
CREATE TRIGGER finance_transactions_prevent_update
  BEFORE UPDATE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_prevent_approved_update();

-- Opening balance locked after first approved/reversed movement
CREATE OR REPLACE FUNCTION finance_prevent_opening_balance_change()
RETURNS trigger AS $$
DECLARE
  movement_count integer;
BEGIN
  IF NEW."openingBalance" IS DISTINCT FROM OLD."openingBalance"
     OR NEW."openingDate" IS DISTINCT FROM OLD."openingDate"
     OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode" THEN
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

-- Period lock guard for transaction mutations
CREATE OR REPLACE FUNCTION finance_reject_locked_period_mutation()
RETURNS trigger AS $$
DECLARE
  period_status text;
BEGIN
  SELECT p."status" INTO period_status
  FROM "finance_periods" p
  WHERE p."companyId" = NEW."companyId"
    AND NEW."transactionDate" >= p."periodStart"
    AND NEW."transactionDate" <= p."periodEnd"
  LIMIT 1;

  IF period_status = 'LOCKED' THEN
    IF TG_OP = 'INSERT' AND NEW."sourceType" NOT IN ('PAYROLL_RUN', 'REVERSAL') THEN
      RAISE EXCEPTION 'FINANCE_PERIOD_LOCKED';
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD."status" IS DISTINCT FROM NEW."status"
       AND NEW."sourceType" NOT IN ('PAYROLL_RUN', 'REVERSAL')
       AND NOT (OLD."status" = 'APPROVED' AND NEW."status" = 'REVERSED') THEN
      RAISE EXCEPTION 'FINANCE_PERIOD_LOCKED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_period_lock ON "finance_transactions";
CREATE TRIGGER finance_transactions_period_lock
  BEFORE INSERT OR UPDATE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_reject_locked_period_mutation();

-- Amount / tax shape checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_transactions_amount_positive'
  ) THEN
    ALTER TABLE "finance_transactions"
      ADD CONSTRAINT finance_transactions_amount_positive CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_transactions_tax_bounds'
  ) THEN
    ALTER TABLE "finance_transactions"
      ADD CONSTRAINT finance_transactions_tax_bounds
      CHECK ("taxAmount" >= 0 AND "taxAmount" <= "amount");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "finance_transactions_reversedBy_unique"
  ON "finance_transactions"("reversedByTransactionId")
  WHERE "reversedByTransactionId" IS NOT NULL;

-- Attendance period reopen guard when consumed by calculated/approved/paid payroll
CREATE OR REPLACE FUNCTION attendance_period_prevent_reopen_when_payroll_linked()
RETURNS trigger AS $$
DECLARE
  linked_count integer;
BEGIN
  IF OLD."status" IN ('PAYROLL_PENDING', 'CLOSED')
     AND NEW."status" NOT IN ('PAYROLL_PENDING', 'CLOSED') THEN
    SELECT COUNT(*) INTO linked_count
    FROM "payroll_run_attendance_periods" link
    JOIN "PayrollRun" run ON run."id" = link."payrollRunId"
    WHERE link."attendancePeriodId" = OLD."id"
      AND run."statusEnum" IN ('CALCULATED', 'APPROVED', 'PAID');
    IF linked_count > 0 THEN
      RAISE EXCEPTION 'ATTENDANCE_PERIOD_IN_USE_BY_PAYROLL';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_periods_payroll_reopen_guard ON "attendance_periods";
CREATE TRIGGER attendance_periods_payroll_reopen_guard
  BEFORE UPDATE ON "attendance_periods"
  FOR EACH ROW EXECUTE FUNCTION attendance_period_prevent_reopen_when_payroll_linked();
