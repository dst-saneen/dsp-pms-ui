ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_ack_pair_check";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_ack_pair_check"
  CHECK (("acknowledgedAt" IS NULL) = ("acknowledgedByUserId" IS NULL))
  NOT VALID;

ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_ack_pair_check";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_ack_pair_check"
  CHECK (("acknowledgedAt" IS NULL) = ("acknowledgedByUserId" IS NULL))
  NOT VALID;

ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_close_date_check";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_close_date_check"
  CHECK ("closedAt" IS NULL OR "closedAt" >= "assignedDate")
  NOT VALID;

ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_revoke_date_check";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_revoke_date_check"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "allocatedAt")
  NOT VALID;

ALTER TABLE "employee_assets" VALIDATE CONSTRAINT "employee_assets_ack_pair_check";
ALTER TABLE "software_license_allocations" VALIDATE CONSTRAINT "software_license_allocations_ack_pair_check";
ALTER TABLE "employee_assets" VALIDATE CONSTRAINT "employee_assets_close_date_check";
ALTER TABLE "software_license_allocations" VALIDATE CONSTRAINT "software_license_allocations_revoke_date_check";
