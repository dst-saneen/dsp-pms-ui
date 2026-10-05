-- Align EmployeeSalaryLine with Prisma composite keys (companyId was missing in DB).

ALTER TABLE "EmployeeSalaryLine"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "EmployeeSalaryLine" esl
SET "companyId" = es."companyId"
FROM "EmployeeSalary" es
WHERE esl."employeeSalaryId" = es.id
  AND esl."companyId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "EmployeeSalaryLine"
    WHERE "companyId" IS NULL
  ) THEN
    RAISE EXCEPTION 'EmployeeSalaryLine companyId backfill incomplete';
  END IF;
END $$;

ALTER TABLE "EmployeeSalaryLine"
  ALTER COLUMN "companyId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalaryLine_companyId_id_key"
  ON "EmployeeSalaryLine"("companyId", "id");

CREATE INDEX IF NOT EXISTS "EmployeeSalaryLine_companyId_employeeSalaryId_idx"
  ON "EmployeeSalaryLine"("companyId", "employeeSalaryId");

ALTER TABLE "EmployeeSalaryLine"
  DROP CONSTRAINT IF EXISTS "EmployeeSalaryLine_companyId_fkey";

ALTER TABLE "EmployeeSalaryLine"
  ADD CONSTRAINT "EmployeeSalaryLine_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeSalaryLine"
  DROP CONSTRAINT IF EXISTS "EmployeeSalaryLine_employeeSalaryId_fkey";

ALTER TABLE "EmployeeSalaryLine"
  ADD CONSTRAINT "EmployeeSalaryLine_employeeSalaryId_fkey"
  FOREIGN KEY ("companyId", "employeeSalaryId")
  REFERENCES "EmployeeSalary"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeSalaryLine"
  DROP CONSTRAINT IF EXISTS "EmployeeSalaryLine_salaryComponentId_fkey";

ALTER TABLE "EmployeeSalaryLine"
  ADD CONSTRAINT "EmployeeSalaryLine_salaryComponentId_fkey"
  FOREIGN KEY ("companyId", "salaryComponentId")
  REFERENCES "SalaryComponent"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
