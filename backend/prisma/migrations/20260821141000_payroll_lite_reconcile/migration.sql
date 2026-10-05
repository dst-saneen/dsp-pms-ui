-- Payroll Lite reconcile: map PROCESSED -> LEGACY_IMPORTED and stop on dirty data.

DO $$
DECLARE
  unknown_status_count integer;
  dup_component_count integer;
  overlapping_salary_count integer;
BEGIN
  UPDATE "PayrollRun"
  SET "statusEnum" = 'LEGACY_IMPORTED'
  WHERE upper("status") = 'PROCESSED'
    AND ("statusEnum" IS NULL OR "statusEnum" = 'DRAFT');

  UPDATE "PayrollRun"
  SET "statusEnum" = 'DRAFT'
  WHERE upper("status") = 'DRAFT'
    AND "statusEnum" IS NULL;

  SELECT COUNT(*) INTO unknown_status_count
  FROM "PayrollRun"
  WHERE upper("status") NOT IN ('DRAFT', 'PROCESSED', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED', 'LEGACY_IMPORTED')
    AND "statusEnum" IS NULL;

  IF unknown_status_count > 0 THEN
    RAISE EXCEPTION 'PAYROLL_RECONCILE_FAILED: % runs have unknown status', unknown_status_count;
  END IF;

  SELECT COUNT(*) INTO dup_component_count
  FROM (
    SELECT "companyId", upper("componentCode") AS code
    FROM "SalaryComponent"
    GROUP BY "companyId", upper("componentCode")
    HAVING COUNT(*) > 1
  ) d;

  IF dup_component_count > 0 THEN
    RAISE EXCEPTION 'PAYROLL_RECONCILE_FAILED: duplicate normalized component codes exist';
  END IF;
END $$;
