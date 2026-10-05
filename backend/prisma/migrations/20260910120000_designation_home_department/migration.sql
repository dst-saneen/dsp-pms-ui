-- Designation optional home Department (separate from onboarding involvement).
-- Existing rows stay NULL; no backfill.

ALTER TABLE "designations"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

CREATE INDEX IF NOT EXISTS "designations_companyId_departmentId_idx"
  ON "designations"("companyId", "departmentId");

ALTER TABLE "designations"
  DROP CONSTRAINT IF EXISTS "designations_companyId_departmentId_fkey";

ALTER TABLE "designations"
  ADD CONSTRAINT "designations_companyId_departmentId_fkey"
  FOREIGN KEY ("companyId", "departmentId")
  REFERENCES "departments"("companyId", "id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;
