-- Asset V2 contract enforcement (Section 8 / plan §5.5).
-- Apply only after preflight exceptions are zero. This migration fails closed
-- if ownership, classification, custody snapshots, or archive evidence is missing.

DO $$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n FROM "asset_types" WHERE "kind" IS NULL OR "trackingMode" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % asset_types missing kind/tracking. Run preflight/backfill first.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "assets"
  WHERE "departmentId" IS NULL OR "branchId" IS NULL OR "kind" IS NULL OR "trackingMode" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % assets missing department/branch/kind/tracking. Run preflight/backfill first.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "assets" WHERE "isActive" = false AND "archivedAt" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % inactive assets missing archivedAt evidence.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "asset_categories" WHERE "isActive" = false AND "archivedAt" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % inactive categories missing archivedAt evidence.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "asset_types" WHERE "isActive" = false AND "archivedAt" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % inactive types missing archivedAt evidence.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "assets"
  WHERE "status" NOT IN ('AVAILABLE', 'ASSIGNED', 'REPAIR', 'LOST', 'DISPOSED');
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % assets have unknown legacy status.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "employee_assets"
  WHERE "status" NOT IN ('ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST');
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % employee_assets have unknown legacy status.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "employee_assets"
  WHERE "companyId" IS NULL OR "branchIdAtAssignment" IS NULL
     OR "departmentIdAtAssignment" IS NULL OR "custodyStatus" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % employee_assets missing custody snapshots. Run backfill first.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "assets" a
  WHERE a.kind = 'HARDWARE' AND nullif(trim(a."serialNumberNormalized"), '') IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % hardware assets missing normalized serial.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM "assets" a
  WHERE a."trackingMode" = 'LOCATION' AND nullif(trim(a.location), '') IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % location assets missing location.', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM "assets" a
  LEFT JOIN "asset_card_details" cd ON cd."assetId" = a.id
  WHERE a.kind = 'CARD' AND cd."assetId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % card assets missing protected card data.', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM "assets" a
  LEFT JOIN "asset_software_license_details" ld ON ld."assetId" = a.id
  WHERE a.kind = 'SOFTWARE_LICENSE' AND ld."assetId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % software assets missing pool data.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM (
    SELECT "assetId" FROM "employee_assets"
    WHERE status = 'ASSIGNED' AND "returnedDate" IS NULL
    GROUP BY "assetId" HAVING COUNT(*) > 1
  ) dups;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % assets have more than one open assignment.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM (
    SELECT "clearanceId" FROM "employee_clearance_items"
    WHERE "clearanceType" = 'ASSET'
    GROUP BY "clearanceId" HAVING COUNT(*) > 1
  ) summaries;
  IF n > 0 THEN
    RAISE EXCEPTION 'Asset V2 contract blocked: % clearances have duplicate ASSET summary rows.', n;
  END IF;
END $$;

-- ============================================================================
-- Type / Asset classification required
-- ============================================================================
ALTER TABLE "asset_types"
  ALTER COLUMN "kind" SET NOT NULL,
  ALTER COLUMN "trackingMode" SET NOT NULL;

ALTER TABLE "assets"
  ALTER COLUMN "departmentId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "kind" SET NOT NULL,
  ALTER COLUMN "trackingMode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "assets_companyId_branchId_id_key"
  ON "assets"("companyId", "branchId", "id");

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_company_branch_fkey";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId")
  REFERENCES "branches"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_company_branch_department_fkey";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_company_branch_department_fkey"
  FOREIGN KEY ("companyId", "branchId", "departmentId")
  REFERENCES "departments"("companyId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_company_type_kind_tracking_fkey";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_company_type_kind_tracking_fkey"
  FOREIGN KEY ("companyId", "assetTypeId", "kind", "trackingMode")
  REFERENCES "asset_types"("companyId", "id", "kind", "trackingMode")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "asset_types" DROP CONSTRAINT IF EXISTS "asset_types_kind_tracking_check";
ALTER TABLE "asset_types"
  ADD CONSTRAINT "asset_types_kind_tracking_check"
  CHECK (
    (kind = 'GENERAL' AND "trackingMode" IN ('LOCATION', 'INDIVIDUAL')) OR
    (kind = 'HARDWARE' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'CARD' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'SOFTWARE_LICENSE' AND "trackingMode" = 'POOL')
  ) NOT VALID;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_kind_tracking_check";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_kind_tracking_check"
  CHECK (
    (kind = 'GENERAL' AND "trackingMode" IN ('LOCATION', 'INDIVIDUAL')) OR
    (kind = 'HARDWARE' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'CARD' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'SOFTWARE_LICENSE' AND "trackingMode" = 'POOL')
  ) NOT VALID;

ALTER TABLE "asset_types" VALIDATE CONSTRAINT "asset_types_kind_tracking_check";
ALTER TABLE "assets" VALIDATE CONSTRAINT "assets_kind_tracking_check";
ALTER TABLE "employee_assets" VALIDATE CONSTRAINT "employee_assets_source_command_pair_check";
ALTER TABLE "software_license_allocations" VALIDATE CONSTRAINT "software_license_allocations_source_command_pair_check";

-- ============================================================================
-- Custody snapshots + replace legacy one-active-assignment index
-- ============================================================================
LOCK TABLE "employee_assets" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "employee_assets"
  DROP CONSTRAINT IF EXISTS "employee_assets_close_state_check",
  DROP CONSTRAINT IF EXISTS "employee_assets_ack_date_check";

ALTER TABLE "employee_assets"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchIdAtAssignment" SET NOT NULL,
  ALTER COLUMN "departmentIdAtAssignment" SET NOT NULL,
  ALTER COLUMN "custodyStatus" SET NOT NULL;

ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_assignment_branch_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_assignment_branch_fkey"
  FOREIGN KEY ("companyId", "branchIdAtAssignment")
  REFERENCES "branches"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_assignment_department_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_assignment_department_fkey"
  FOREIGN KEY ("companyId", "branchIdAtAssignment", "departmentIdAtAssignment")
  REFERENCES "departments"("companyId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP INDEX IF EXISTS "employee_assets_one_active_assignment_per_asset_idx";
DROP INDEX IF EXISTS "employee_assets_one_active_custody_per_asset_idx";

CREATE UNIQUE INDEX "employee_assets_one_active_assignment_per_asset_idx"
  ON "employee_assets"("assetId")
  WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL;

DROP INDEX IF EXISTS "employee_assets_companyId_id_employeeId_key";
CREATE UNIQUE INDEX "employee_assets_companyId_id_employeeId_key"
  ON "employee_assets"("companyId", "id", "employeeId");

ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_close_state_check"
  CHECK (
    ("custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL) OR
    ("custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST', 'WAIVED')
      AND "closedAt" IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT "employee_assets_ack_date_check"
  CHECK ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "assignedDate") NOT VALID;

ALTER TABLE "employee_assets" VALIDATE CONSTRAINT "employee_assets_close_state_check";
ALTER TABLE "employee_assets" VALIDATE CONSTRAINT "employee_assets_ack_date_check";

CREATE UNIQUE INDEX IF NOT EXISTS "employee_clearance_items_one_asset_summary_idx"
  ON "employee_clearance_items"("clearanceId")
  WHERE "clearanceType" = 'ASSET';

-- ============================================================================
-- Trigger backstops (plan §4.14). Application still returns domain errors first.
-- ============================================================================
CREATE OR REPLACE FUNCTION "asset_v2_raise"(code text)
RETURNS void AS $$
BEGIN
  RAISE EXCEPTION '%', code USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "asset_type_classification_guard"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW."assetCategoryId" IS DISTINCT FROM OLD."assetCategoryId"
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW."trackingMode" IS DISTINCT FROM OLD."trackingMode"
     )
     AND EXISTS (SELECT 1 FROM "assets" a WHERE a."assetTypeId" = NEW.id)
  THEN
    PERFORM "asset_v2_raise"('ASSET_TYPE_CLASSIFICATION_IMMUTABLE');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_asset_type_classification_guard" ON "asset_types";
CREATE TRIGGER "trg_asset_type_classification_guard"
  BEFORE UPDATE ON "asset_types"
  FOR EACH ROW EXECUTE FUNCTION "asset_type_classification_guard"();

CREATE OR REPLACE FUNCTION "asset_cross_branch_transfer_guard"()
RETURNS trigger AS $$
BEGIN
  IF NEW."branchId" IS DISTINCT FROM OLD."branchId"
     AND NEW."trackingMode" <> 'POOL'
     AND EXISTS (
       SELECT 1 FROM "employee_assets" ea
       WHERE ea."assetId" = NEW.id
         AND ea."custodyStatus" = 'ASSIGNED'
         AND ea."closedAt" IS NULL
     )
  THEN
    PERFORM "asset_v2_raise"('ASSET_TRANSFER_ACTIVE_CUSTODY');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_asset_cross_branch_transfer_guard" ON "assets";
CREATE TRIGGER "trg_asset_cross_branch_transfer_guard"
  BEFORE UPDATE ON "assets"
  FOR EACH ROW EXECUTE FUNCTION "asset_cross_branch_transfer_guard"();

CREATE OR REPLACE FUNCTION "employee_organization_custody_guard"()
RETURNS trigger AS $$
BEGIN
  IF NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
    PERFORM "asset_v2_raise"('EMPLOYEE_ASSET_TRANSFER_BLOCKED');
  END IF;

  IF NEW."branchId" IS DISTINCT FROM OLD."branchId"
     AND EXISTS (
       SELECT 1
       FROM "employee_assets" ea
       JOIN "assets" a ON a.id = ea."assetId"
       WHERE ea."employeeId" = NEW.id
         AND ea."custodyStatus" = 'ASSIGNED'
         AND ea."closedAt" IS NULL
         AND a.kind <> 'SOFTWARE_LICENSE'
     )
  THEN
    PERFORM "asset_v2_raise"('EMPLOYEE_ASSET_TRANSFER_BLOCKED');
  END IF;

  IF (NEW."isActive" = false OR NEW."employmentStatus" IN ('RESIGNED', 'TERMINATED'))
     AND (
       EXISTS (
         SELECT 1 FROM "employee_assets" ea
         WHERE ea."employeeId" = NEW.id
           AND ea."custodyStatus" = 'ASSIGNED'
           AND ea."closedAt" IS NULL
       ) OR EXISTS (
         SELECT 1 FROM "software_license_allocations" la
         WHERE la."employeeId" = NEW.id AND la.status = 'ACTIVE'
       )
     )
  THEN
    PERFORM "asset_v2_raise"('ASSET_CLEARANCE_BLOCKED');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_employee_organization_custody_guard" ON "employees";
CREATE TRIGGER "trg_employee_organization_custody_guard"
  BEFORE UPDATE ON "employees"
  FOR EACH ROW EXECUTE FUNCTION "employee_organization_custody_guard"();

CREATE OR REPLACE FUNCTION "organization_reparent_guard"()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'branches' AND NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
    PERFORM "asset_v2_raise"('ASSET_DEPARTMENT_BRANCH_MISMATCH');
  END IF;
  IF TG_TABLE_NAME = 'departments'
     AND (
       NEW."companyId" IS DISTINCT FROM OLD."companyId"
       OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
     )
  THEN
    PERFORM "asset_v2_raise"('ASSET_DEPARTMENT_BRANCH_MISMATCH');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_organization_reparent_guard_branches" ON "branches";
CREATE TRIGGER "trg_organization_reparent_guard_branches"
  BEFORE UPDATE ON "branches"
  FOR EACH ROW EXECUTE FUNCTION "organization_reparent_guard"();

DROP TRIGGER IF EXISTS "trg_organization_reparent_guard_departments" ON "departments";
CREATE TRIGGER "trg_organization_reparent_guard_departments"
  BEFORE UPDATE ON "departments"
  FOR EACH ROW EXECUTE FUNCTION "organization_reparent_guard"();

CREATE OR REPLACE FUNCTION "employee_asset_eligibility_guard"()
RETURNS trigger AS $$
DECLARE
  emp "employees"%ROWTYPE;
  ast "assets"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "asset_v2_raise"('ASSET_ASSIGNMENT_ALREADY_CLOSED');
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST', 'WAIVED')
     AND NEW."custodyStatus" IS DISTINCT FROM OLD."custodyStatus"
  THEN
    PERFORM "asset_v2_raise"('ASSET_ASSIGNMENT_ALREADY_CLOSED');
  END IF;

  IF NOT (
    (TG_OP = 'INSERT' AND NEW."custodyStatus" = 'ASSIGNED' AND NEW."closedAt" IS NULL)
    OR (TG_OP = 'UPDATE' AND NEW."custodyStatus" = 'ASSIGNED' AND NEW."closedAt" IS NULL
        AND (OLD."custodyStatus" IS DISTINCT FROM 'ASSIGNED' OR OLD."closedAt" IS NOT NULL))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO emp FROM "employees" WHERE id = NEW."employeeId" FOR UPDATE;
  SELECT * INTO ast FROM "assets" WHERE id = NEW."assetId" FOR UPDATE;

  IF emp.id IS NULL OR ast.id IS NULL THEN
    PERFORM "asset_v2_raise"('ASSET_NOT_FOUND');
  END IF;

  IF ast."archivedAt" IS NOT NULL
     OR ast."trackingMode" <> 'INDIVIDUAL'
     OR ast.kind = 'SOFTWARE_LICENSE'
     OR ast."lifecycleStatus" <> 'ACTIVE'
  THEN
    PERFORM "asset_v2_raise"('ASSET_NOT_AVAILABLE');
  END IF;

  IF emp."isActive" = false
     OR emp."employmentStatus" NOT IN ('PENDING_ONBOARDING', 'PROBATION', 'ACTIVE', 'NOTICE')
  THEN
    PERFORM "asset_v2_raise"('EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET');
  END IF;

  IF EXISTS (
       SELECT 1 FROM "employee_separations" s
       WHERE s."employeeId" = emp.id AND s.status IN ('SUBMITTED', 'APPROVED')
     )
     OR EXISTS (
       SELECT 1
       FROM "employee_separations" s
       JOIN "employee_clearances" c ON c."separationId" = s.id
       WHERE s."employeeId" = emp.id AND c.status IN ('PENDING', 'IN_PROGRESS')
     )
  THEN
    PERFORM "asset_v2_raise"('EMPLOYEE_ASSET_CLEARANCE_ACTIVE');
  END IF;

  IF emp."companyId" <> ast."companyId" OR emp."branchId" <> ast."branchId" THEN
    PERFORM "asset_v2_raise"('ASSET_EMPLOYEE_BRANCH_MISMATCH');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_employee_asset_eligibility_guard" ON "employee_assets";
CREATE TRIGGER "trg_employee_asset_eligibility_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "employee_assets"
  FOR EACH ROW EXECUTE FUNCTION "employee_asset_eligibility_guard"();

CREATE OR REPLACE FUNCTION "employee_asset_actor_guard"()
RETURNS trigger AS $$
DECLARE
  actor_employee_id text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW."custodyStatus" = 'ASSIGNED' AND NEW."assignedByUserId" IS NULL THEN
    PERFORM "asset_v2_raise"('ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."assignedByUserId" IS NOT NULL
       AND NEW."assignedByUserId" IS DISTINCT FROM OLD."assignedByUserId" THEN
      PERFORM "asset_v2_raise"('ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH');
    END IF;
    IF OLD."closedByUserId" IS NOT NULL
       AND NEW."closedByUserId" IS DISTINCT FROM OLD."closedByUserId" THEN
      PERFORM "asset_v2_raise"('ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH');
    END IF;
    IF OLD."custodyStatus" = 'ASSIGNED'
       AND NEW."custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST', 'WAIVED')
       AND NEW."closedByUserId" IS NULL THEN
      PERFORM "asset_v2_raise"('ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH');
    END IF;
    IF NEW."acknowledgedAt" IS NOT NULL
       AND NEW."acknowledgedByUserId" IS NOT NULL
       AND (OLD."acknowledgedAt" IS NULL OR OLD."acknowledgedByUserId" IS DISTINCT FROM NEW."acknowledgedByUserId")
    THEN
      SELECT "employeeId" INTO actor_employee_id
      FROM "users" WHERE id = NEW."acknowledgedByUserId";
      IF actor_employee_id IS DISTINCT FROM NEW."employeeId" THEN
        PERFORM "asset_v2_raise"('ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_employee_asset_actor_guard" ON "employee_assets";
CREATE TRIGGER "trg_employee_asset_actor_guard"
  BEFORE INSERT OR UPDATE ON "employee_assets"
  FOR EACH ROW EXECUTE FUNCTION "employee_asset_actor_guard"();

CREATE OR REPLACE FUNCTION "software_license_allocation_guard"()
RETURNS trigger AS $$
DECLARE
  emp "employees"%ROWTYPE;
  ast "assets"%ROWTYPE;
  seats integer;
  capacity integer;
  actor_employee_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "asset_v2_raise"('LICENSE_ALLOCATION_ALREADY_CLOSED');
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE') THEN
    SELECT * INTO emp FROM "employees" WHERE id = NEW."employeeId" FOR UPDATE;
    SELECT * INTO ast FROM "assets" WHERE id = NEW."assetId" FOR UPDATE;

    IF ast.kind <> 'SOFTWARE_LICENSE' OR ast."trackingMode" <> 'POOL' OR ast."archivedAt" IS NOT NULL THEN
      PERFORM "asset_v2_raise"('ASSET_NOT_AVAILABLE');
    END IF;
    IF ast."lifecycleStatus" <> 'ACTIVE' THEN
      PERFORM "asset_v2_raise"('LICENSE_POOL_NOT_ACTIVE');
    END IF;
    IF emp."isActive" = false
       OR emp."employmentStatus" NOT IN ('PENDING_ONBOARDING', 'PROBATION', 'ACTIVE', 'NOTICE')
       OR emp."companyId" <> ast."companyId"
    THEN
      PERFORM "asset_v2_raise"('EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET');
    END IF;
    IF EXISTS (
         SELECT 1 FROM "employee_separations" s
         WHERE s."employeeId" = emp.id AND s.status IN ('SUBMITTED', 'APPROVED')
       )
       OR EXISTS (
         SELECT 1
         FROM "employee_separations" s
         JOIN "employee_clearances" c ON c."separationId" = s.id
         WHERE s."employeeId" = emp.id AND c.status IN ('PENDING', 'IN_PROGRESS')
       )
    THEN
      PERFORM "asset_v2_raise"('EMPLOYEE_ASSET_CLEARANCE_ACTIVE');
    END IF;

    SELECT "seatCapacity" INTO capacity
    FROM "asset_software_license_details" WHERE "assetId" = NEW."assetId" FOR UPDATE;
    SELECT COUNT(*) INTO seats
    FROM "software_license_allocations"
    WHERE "assetId" = NEW."assetId" AND status = 'ACTIVE';
    IF capacity IS NULL OR seats >= capacity THEN
      PERFORM "asset_v2_raise"('LICENSE_NO_SEATS_AVAILABLE');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW."acknowledgedAt" IS NOT NULL
     AND NEW."acknowledgedByUserId" IS NOT NULL
     AND (OLD."acknowledgedAt" IS NULL OR OLD."acknowledgedByUserId" IS DISTINCT FROM NEW."acknowledgedByUserId")
  THEN
    SELECT "employeeId" INTO actor_employee_id
    FROM "users" WHERE id = NEW."acknowledgedByUserId";
    IF actor_employee_id IS DISTINCT FROM NEW."employeeId" THEN
      PERFORM "asset_v2_raise"('ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH');
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_software_license_allocation_guard" ON "software_license_allocations";
CREATE TRIGGER "trg_software_license_allocation_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "software_license_allocations"
  FOR EACH ROW EXECUTE FUNCTION "software_license_allocation_guard"();

CREATE OR REPLACE FUNCTION "asset_shape_guard"()
RETURNS trigger AS $$
DECLARE
  asset_id text;
  asset_kind "AssetKind";
  tracking "AssetTrackingMode";
  serial text;
  loc text;
  cards integer;
  licenses integer;
BEGIN
  IF TG_TABLE_NAME = 'assets' THEN
    asset_id := NEW.id;
    asset_kind := NEW.kind;
    tracking := NEW."trackingMode";
    serial := NEW."serialNumberNormalized";
    loc := NEW.location;
  ELSE
    asset_id := NEW."assetId";
    SELECT a.kind, a."trackingMode", a."serialNumberNormalized", a.location
      INTO asset_kind, tracking, serial, loc
    FROM "assets" a WHERE a.id = asset_id;
  END IF;

  SELECT COUNT(*) INTO cards FROM "asset_card_details" WHERE "assetId" = asset_id;
  SELECT COUNT(*) INTO licenses FROM "asset_software_license_details" WHERE "assetId" = asset_id;

  IF tracking = 'LOCATION' AND nullif(trim(coalesce(loc, '')), '') IS NULL THEN
    PERFORM "asset_v2_raise"('ASSET_KIND_DETAILS_INVALID');
  END IF;
  IF asset_kind = 'HARDWARE' AND nullif(trim(coalesce(serial, '')), '') IS NULL THEN
    PERFORM "asset_v2_raise"('ASSET_KIND_DETAILS_INVALID');
  END IF;
  IF asset_kind = 'CARD' AND (cards <> 1 OR licenses <> 0) THEN
    PERFORM "asset_v2_raise"('ASSET_KIND_DETAILS_INVALID');
  END IF;
  IF asset_kind = 'SOFTWARE_LICENSE' AND (licenses <> 1 OR cards <> 0) THEN
    PERFORM "asset_v2_raise"('ASSET_KIND_DETAILS_INVALID');
  END IF;
  IF asset_kind NOT IN ('CARD', 'SOFTWARE_LICENSE') AND (cards <> 0 OR licenses <> 0) THEN
    PERFORM "asset_v2_raise"('ASSET_KIND_DETAILS_INVALID');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_asset_shape_guard_assets" ON "assets";
CREATE CONSTRAINT TRIGGER "trg_asset_shape_guard_assets"
  AFTER INSERT OR UPDATE ON "assets"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "asset_shape_guard"();

DROP TRIGGER IF EXISTS "trg_asset_shape_guard_cards" ON "asset_card_details";
CREATE CONSTRAINT TRIGGER "trg_asset_shape_guard_cards"
  AFTER INSERT OR UPDATE ON "asset_card_details"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "asset_shape_guard"();

DROP TRIGGER IF EXISTS "trg_asset_shape_guard_licenses" ON "asset_software_license_details";
CREATE CONSTRAINT TRIGGER "trg_asset_shape_guard_licenses"
  AFTER INSERT OR UPDATE ON "asset_software_license_details"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "asset_shape_guard"();

CREATE OR REPLACE FUNCTION "asset_operational_state_guard"()
RETURNS trigger AS $$
BEGIN
  IF NEW."archivedAt" IS NOT NULL
     AND (
       EXISTS (
         SELECT 1 FROM "employee_assets" ea
         WHERE ea."assetId" = NEW.id
           AND ea."custodyStatus" = 'ASSIGNED'
           AND ea."closedAt" IS NULL
       ) OR EXISTS (
         SELECT 1 FROM "software_license_allocations" la
         WHERE la."assetId" = NEW.id AND la.status = 'ACTIVE'
       ) OR EXISTS (
         SELECT 1 FROM "asset_custody_requests" r
         WHERE r.status IN ('SUBMITTED', 'IN_REVIEW')
           AND (
             r."employeeAssetId" IN (SELECT id FROM "employee_assets" WHERE "assetId" = NEW.id)
             OR r."licenseAllocationId" IN (SELECT id FROM "software_license_allocations" WHERE "assetId" = NEW.id)
           )
       ) OR EXISTS (
         SELECT 1 FROM "asset_ownership_transfers" t
         WHERE t."assetId" = NEW.id AND t.status = 'PENDING'
       )
     )
  THEN
    PERFORM "asset_v2_raise"('ASSET_ACTIVE_CUSTODY_EXISTS');
  END IF;

  IF NEW."lifecycleStatus" IN ('DISPOSED', 'RETIRED', 'LOST')
     AND EXISTS (
       SELECT 1 FROM "employee_assets" ea
       WHERE ea."assetId" = NEW.id
         AND ea."custodyStatus" = 'ASSIGNED'
         AND ea."closedAt" IS NULL
     )
  THEN
    PERFORM "asset_v2_raise"('ASSET_ACTIVE_CUSTODY_EXISTS');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_asset_operational_state_guard" ON "assets";
CREATE TRIGGER "trg_asset_operational_state_guard"
  BEFORE UPDATE ON "assets"
  FOR EACH ROW EXECUTE FUNCTION "asset_operational_state_guard"();

CREATE OR REPLACE FUNCTION "asset_clearance_link_guard"()
RETURNS trigger AS $$
DECLARE
  summary_clearance_id text;
  summary_type text;
  sep_employee_id text;
  target_employee_id text;
BEGIN
  SELECT s."clearanceId", s."clearanceType"
    INTO summary_clearance_id, summary_type
  FROM "employee_clearance_items" s
  WHERE s.id = NEW."clearanceSummaryItemId";

  SELECT sep."employeeId" INTO sep_employee_id
  FROM "employee_clearances" c
  JOIN "employee_separations" sep ON sep.id = c."separationId"
  WHERE c.id = NEW."clearanceId";

  SELECT COALESCE(ea."employeeId", la."employeeId") INTO target_employee_id
  FROM (SELECT NEW."employeeAssetId" AS ea_id, NEW."licenseAllocationId" AS la_id) x
  LEFT JOIN "employee_assets" ea ON ea.id = x.ea_id
  LEFT JOIN "software_license_allocations" la ON la.id = x.la_id;

  IF summary_clearance_id IS DISTINCT FROM NEW."clearanceId"
     OR summary_type <> 'ASSET'
     OR sep_employee_id IS DISTINCT FROM NEW."employeeId"
     OR target_employee_id IS DISTINCT FROM NEW."employeeId"
  THEN
    PERFORM "asset_v2_raise"('ASSET_CLEARANCE_BLOCKED');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_asset_clearance_link_guard" ON "asset_clearance_items";
CREATE CONSTRAINT TRIGGER "trg_asset_clearance_link_guard"
  AFTER INSERT OR UPDATE ON "asset_clearance_items"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "asset_clearance_link_guard"();

CREATE OR REPLACE FUNCTION "asset_domain_action_event_guard"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "asset_v2_raise"('ASSET_HISTORY_IMMUTABLE');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_asset_domain_action_event_guard" ON "asset_domain_action_events";
CREATE TRIGGER "trg_asset_domain_action_event_guard"
  BEFORE UPDATE OR DELETE ON "asset_domain_action_events"
  FOR EACH ROW EXECUTE FUNCTION "asset_domain_action_event_guard"();
