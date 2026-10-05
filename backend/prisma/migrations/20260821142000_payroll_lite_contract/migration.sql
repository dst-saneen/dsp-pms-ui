-- Payroll Lite contract: maker-checker and immutability backstops.

CREATE OR REPLACE FUNCTION payroll_prevent_self_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW."statusEnum" = 'APPROVED'
     AND NEW."approvedByUserId" IS NOT NULL
     AND NEW."createdByUserId" IS NOT NULL
     AND NEW."createdByUserId" = NEW."approvedByUserId" THEN
    RAISE EXCEPTION 'PAYROLL_SELF_APPROVAL_FORBIDDEN';
  END IF;
  IF NEW."statusEnum" = 'APPROVED'
     AND NEW."calculatedByUserId" IS NOT NULL
     AND NEW."approvedByUserId" IS NOT NULL
     AND NEW."calculatedByUserId" = NEW."approvedByUserId" THEN
    RAISE EXCEPTION 'PAYROLL_SELF_APPROVAL_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_self_approval ON "PayrollRun";
CREATE TRIGGER payroll_runs_self_approval
  BEFORE INSERT OR UPDATE ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_self_approval();

CREATE OR REPLACE FUNCTION payroll_prevent_paid_without_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW."statusEnum" = 'PAID' AND (
    NEW."approvedByUserId" IS NULL OR NEW."approvedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'PAYROLL_PAYMENT_WITHOUT_APPROVAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_paid_requires_approval ON "PayrollRun";
CREATE TRIGGER payroll_runs_paid_requires_approval
  BEFORE INSERT OR UPDATE ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_paid_without_approval();

CREATE OR REPLACE FUNCTION payroll_prevent_immutable_run_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD."statusEnum" IN ('APPROVED', 'PAID', 'LEGACY_IMPORTED') THEN
    RAISE EXCEPTION 'PAYROLL_RUN_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_prevent_delete ON "PayrollRun";
CREATE TRIGGER payroll_runs_prevent_delete
  BEFORE DELETE ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION payroll_prevent_immutable_run_delete();
