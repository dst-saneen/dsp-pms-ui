-- Stamp LeaveRequest with companyId from the owning Employee, then
-- company-qualify the payroll snapshot leave-request foreign key.

ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "leave_requests" lr
SET "companyId" = e."companyId"
FROM "employees" e
WHERE e."id" = lr."employeeId"
  AND lr."companyId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "leave_requests" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'LEAVE_REQUEST_COMPANY_BACKFILL_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE "leave_requests"
  ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "leave_requests_companyId_idx"
  ON "leave_requests"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "leave_requests_companyId_id_key"
  ON "leave_requests"("companyId", "id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_companyId_fkey'
  ) THEN
    ALTER TABLE "leave_requests"
      ADD CONSTRAINT "leave_requests_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'leave_requests'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%employeeId%'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%companyId%, %employeeId%'
  LOOP
    EXECUTE format('ALTER TABLE "leave_requests" DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_company_employee_fkey'
  ) THEN
    ALTER TABLE "leave_requests"
      ADD CONSTRAINT "leave_requests_company_employee_fkey"
      FOREIGN KEY ("companyId", "employeeId")
      REFERENCES "employees"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PayrollRunEmployeeLine" l
    JOIN "leave_requests" r ON r."id" = l."leaveRequestId"
    WHERE l."leaveRequestId" IS NOT NULL
      AND l."companyId" IS DISTINCT FROM r."companyId"
  ) THEN
    RAISE EXCEPTION 'PAYROLL_LEAVE_REQUEST_CROSS_COMPANY';
  END IF;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'PayrollRunEmployeeLine'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%leaveRequestId%'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%companyId%, %leaveRequestId%'
  LOOP
    EXECUTE format('ALTER TABLE "PayrollRunEmployeeLine" DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRunEmployeeLine_company_leaveRequest_fkey'
  ) THEN
    ALTER TABLE "PayrollRunEmployeeLine"
      ADD CONSTRAINT "PayrollRunEmployeeLine_company_leaveRequest_fkey"
      FOREIGN KEY ("companyId", "leaveRequestId")
      REFERENCES "leave_requests"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;
