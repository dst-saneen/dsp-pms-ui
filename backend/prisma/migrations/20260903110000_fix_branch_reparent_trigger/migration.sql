-- Fix: shared organization_reparent_guard referenced NEW."branchId" while attached
-- to branches (which has no branchId). PostgreSQL then fails any UPDATE on branches
-- with: record "new" has no field "branchId".
-- Split into table-specific trigger functions.

CREATE OR REPLACE FUNCTION "organization_reparent_guard_branches"()
RETURNS trigger AS $$
BEGIN
  IF NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
    PERFORM "asset_v2_raise"('ASSET_DEPARTMENT_BRANCH_MISMATCH');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "organization_reparent_guard_departments"()
RETURNS trigger AS $$
BEGIN
  IF NEW."companyId" IS DISTINCT FROM OLD."companyId"
     OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
  THEN
    PERFORM "asset_v2_raise"('ASSET_DEPARTMENT_BRANCH_MISMATCH');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_organization_reparent_guard_branches" ON "branches";
CREATE TRIGGER "trg_organization_reparent_guard_branches"
  BEFORE UPDATE ON "branches"
  FOR EACH ROW EXECUTE FUNCTION "organization_reparent_guard_branches"();

DROP TRIGGER IF EXISTS "trg_organization_reparent_guard_departments" ON "departments";
CREATE TRIGGER "trg_organization_reparent_guard_departments"
  BEFORE UPDATE ON "departments"
  FOR EACH ROW EXECUTE FUNCTION "organization_reparent_guard_departments"();

-- Keep old shared function name as a safe no-op dispatcher for any leftover callers.
CREATE OR REPLACE FUNCTION "organization_reparent_guard"()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'branches' THEN
    IF NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
      PERFORM "asset_v2_raise"('ASSET_DEPARTMENT_BRANCH_MISMATCH');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'departments' THEN
    -- BranchId access must stay inside this block only (never in a shared expression
    -- evaluated against the branches row type).
    IF NEW."companyId" IS DISTINCT FROM OLD."companyId"
       OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    THEN
      PERFORM "asset_v2_raise"('ASSET_DEPARTMENT_BRANCH_MISMATCH');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
