-- Onboarding Template P0/P1 hardening.
-- Expand/backfill/contract is intentionally contained in one migration because
-- the preceding Template preflight must be clean before this file is deployed.

-- ---------------------------------------------------------------------------
-- Tenant-qualified Template and assignment ownership
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "designations_companyId_id_key"
  ON "designations" ("companyId", "id");

UPDATE "designation_onboarding_assignments" assignment
SET "companyId" = designation."companyId"
FROM "designations" designation
WHERE assignment."designationId" = designation.id
  AND assignment."companyId" IS NULL;

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "designation_onboarding_assignments" assignment
  LEFT JOIN "designations" designation
    ON designation.id = assignment."designationId"
  LEFT JOIN "OnboardingTemplate" template
    ON template.id = assignment."onboardingTemplateId"
  LEFT JOIN "branches" branch
    ON branch.id = assignment."branchId"
  WHERE assignment."companyId" IS NULL
     OR designation.id IS NULL
     OR template.id IS NULL
     OR assignment."companyId" IS DISTINCT FROM designation."companyId"
     OR assignment."companyId" IS DISTINCT FROM template."companyId"
     OR (
       assignment."branchId" IS NOT NULL
       AND assignment."companyId" IS DISTINCT FROM branch."companyId"
     );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'Onboarding Template hardening blocked: % assignment tenant mismatch row(s) remain.',
      invalid_count;
  END IF;
END $$;

ALTER TABLE "designation_onboarding_assignments"
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "OnboardingTemplateVersion"
  DROP CONSTRAINT IF EXISTS "OnboardingTemplateVersion_onboardingTemplateId_fkey",
  DROP CONSTRAINT IF EXISTS "OnboardingTemplateVersion_company_template_fkey";

ALTER TABLE "OnboardingTemplateVersion"
  ADD CONSTRAINT "OnboardingTemplateVersion_company_template_fkey"
  FOREIGN KEY ("companyId", "onboardingTemplateId")
  REFERENCES "OnboardingTemplate" ("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "designation_onboarding_assignments"
  DROP CONSTRAINT IF EXISTS "designation_onboarding_assignments_designationId_fkey",
  DROP CONSTRAINT IF EXISTS "designation_onboarding_assignments_branchId_fkey",
  DROP CONSTRAINT IF EXISTS "designation_onboarding_assignments_onboardingTemplateId_fkey",
  DROP CONSTRAINT IF EXISTS "designation_onboarding_assignments_company_designation_fkey",
  DROP CONSTRAINT IF EXISTS "designation_onboarding_assignments_company_branch_fkey",
  DROP CONSTRAINT IF EXISTS "designation_onboarding_assignments_company_template_fkey";

ALTER TABLE "designation_onboarding_assignments"
  ADD CONSTRAINT "designation_onboarding_assignments_company_designation_fkey"
  FOREIGN KEY ("companyId", "designationId")
  REFERENCES "designations" ("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "designation_onboarding_assignments_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId")
  REFERENCES "branches" ("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "designation_onboarding_assignments_company_template_fkey"
  FOREIGN KEY ("companyId", "onboardingTemplateId")
  REFERENCES "OnboardingTemplate" ("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------------
-- Serialize effective-range checks for API and direct SQL writers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION designation_onboarding_assignment_overlap_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count integer;
  assignment_lock_key text;
BEGIN
  IF NEW."isActive" = false THEN
    RETURN NEW;
  END IF;

  assignment_lock_key :=
    'onboarding-assignment:' || NEW."designationId" || ':' ||
    COALESCE(NEW."branchId", 'COMPANY');
  PERFORM pg_advisory_xact_lock(hashtextextended(assignment_lock_key, 0));

  SELECT COUNT(*) INTO overlap_count
  FROM "designation_onboarding_assignments" existing
  WHERE existing."designationId" = NEW."designationId"
    AND existing.id <> NEW.id
    AND existing."isActive" = true
    AND existing."branchId" IS NOT DISTINCT FROM NEW."branchId"
    AND existing."effectiveFrom" <=
      COALESCE(NEW."effectiveTo", '9999-12-31'::timestamp)
    AND NEW."effectiveFrom" <=
      COALESCE(existing."effectiveTo", '9999-12-31'::timestamp);

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'ONBOARDING_ASSIGNMENT_EFFECTIVE_RANGE_OVERLAP'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS designation_onboarding_assignment_overlap_trg
  ON "designation_onboarding_assignments";
CREATE TRIGGER designation_onboarding_assignment_overlap_trg
BEFORE INSERT OR UPDATE ON "designation_onboarding_assignments"
FOR EACH ROW
EXECUTE FUNCTION designation_onboarding_assignment_overlap_guard();

-- ---------------------------------------------------------------------------
-- Draft-only hierarchy writes, including INSERT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION onboarding_reject_immutable_template_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_id text;
  version_status "TemplateVersionStatus";
BEGIN
  IF TG_TABLE_NAME = 'OnboardingDepartmentTemplate' THEN
    version_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD."onboardingTemplateVersionId"
      ELSE NEW."onboardingTemplateVersionId"
    END;
  ELSIF TG_TABLE_NAME = 'OnboardingTaskGroup' THEN
    version_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD."onboardingTemplateVersionId"
      ELSE NEW."onboardingTemplateVersionId"
    END;
  ELSE
    version_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD."onboardingTemplateVersionId"
      ELSE NEW."onboardingTemplateVersionId"
    END;
  END IF;

  SELECT status INTO version_status
  FROM "OnboardingTemplateVersion"
  WHERE id = version_id
  FOR UPDATE;

  IF version_status IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_TEMPLATE_VERSION_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF version_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'ONBOARDING_TEMPLATE_VERSION_IMMUTABLE'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_department_template_immutable_trg
  ON "OnboardingDepartmentTemplate";
CREATE TRIGGER onboarding_department_template_immutable_trg
BEFORE INSERT OR UPDATE OR DELETE ON "OnboardingDepartmentTemplate"
FOR EACH ROW
EXECUTE FUNCTION onboarding_reject_immutable_template_child();

DROP TRIGGER IF EXISTS onboarding_task_group_immutable_trg
  ON "OnboardingTaskGroup";
CREATE TRIGGER onboarding_task_group_immutable_trg
BEFORE INSERT OR UPDATE OR DELETE ON "OnboardingTaskGroup"
FOR EACH ROW
EXECUTE FUNCTION onboarding_reject_immutable_template_child();

DROP TRIGGER IF EXISTS onboarding_template_task_immutable_trg
  ON "OnboardingTemplateTask";
CREATE TRIGGER onboarding_template_task_immutable_trg
BEFORE INSERT OR UPDATE OR DELETE ON "OnboardingTemplateTask"
FOR EACH ROW
EXECUTE FUNCTION onboarding_reject_immutable_template_child();

-- ---------------------------------------------------------------------------
-- Authoritative owner/reference shape for every new or edited draft task
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION onboarding_template_task_shape_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  enclosing_department_id text;
  asset_type_valid boolean;
BEGIN
  SELECT slice."departmentId" INTO enclosing_department_id
  FROM "OnboardingTaskGroup" task_group
  JOIN "OnboardingDepartmentTemplate" slice
    ON slice.id = task_group."onboardingDepartmentTemplateId"
  WHERE task_group.id = NEW."taskGroupId";

  IF enclosing_department_id IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_TEMPLATE_TASK_GROUP_NOT_FOUND'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW."ownerType" = 'DEPARTMENT' THEN
    IF NEW."assignedDepartmentId" IS DISTINCT FROM enclosing_department_id THEN
      RAISE EXCEPTION 'ONBOARDING_TEMPLATE_DEPARTMENT_OWNER_MISMATCH'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."ownerType" IN ('EMPLOYEE', 'MANAGER') THEN
    IF NEW."assignedDepartmentId" IS NOT NULL THEN
      RAISE EXCEPTION 'ONBOARDING_TEMPLATE_INDIVIDUAL_OWNER_HAS_DEPARTMENT'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    RAISE EXCEPTION 'ONBOARDING_TEMPLATE_OWNER_UNSUPPORTED'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."assignedEmployeeId" IS NOT NULL
     OR NEW."assignedDesignationId" IS NOT NULL
     OR NEW."approvalWorkflowId" IS NOT NULL
     OR NEW."autoComplete" = true THEN
    RAISE EXCEPTION 'ONBOARDING_TEMPLATE_TASK_SHAPE_UNSUPPORTED'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."workType" = 'CHECKLIST' THEN
    IF NEW."referenceType" IS NOT NULL OR NEW."referenceId" IS NOT NULL THEN
      RAISE EXCEPTION 'ONBOARDING_TEMPLATE_CHECKLIST_REFERENCE_FORBIDDEN'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."workType" = 'ASSET' THEN
    IF NEW."ownerType" <> 'DEPARTMENT'
       OR NEW."referenceType" IS DISTINCT FROM 'ASSET_TYPE'
       OR NEW."referenceId" IS NULL THEN
      RAISE EXCEPTION 'ONBOARDING_TEMPLATE_ASSET_TASK_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM "asset_types" asset_type
      WHERE asset_type.id = NEW."referenceId"
        AND asset_type."companyId" = NEW."companyId"
        AND asset_type."isActive" = true
        AND asset_type."archivedAt" IS NULL
        AND asset_type."trackingMode" IN ('INDIVIDUAL', 'POOL')
    ) INTO asset_type_valid;

    IF NOT asset_type_valid THEN
      RAISE EXCEPTION 'ONBOARDING_TEMPLATE_ASSET_TYPE_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    RAISE EXCEPTION 'ONBOARDING_TEMPLATE_WORK_TYPE_UNSUPPORTED'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_template_task_shape_guard_trg
  ON "OnboardingTemplateTask";
CREATE TRIGGER onboarding_template_task_shape_guard_trg
BEFORE INSERT OR UPDATE ON "OnboardingTemplateTask"
FOR EACH ROW
EXECUTE FUNCTION onboarding_template_task_shape_guard();

-- ---------------------------------------------------------------------------
-- Complete deferred publish backstop
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION onboarding_template_version_publish_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bad_tasks integer;
  has_cycle boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'PUBLISHED'
     AND OLD.status = 'DRAFT' THEN
    SELECT COUNT(*) INTO bad_tasks
    FROM "OnboardingTemplateTask" task
    JOIN "OnboardingTaskGroup" task_group
      ON task_group.id = task."taskGroupId"
    JOIN "OnboardingDepartmentTemplate" slice
      ON slice.id = task_group."onboardingDepartmentTemplateId"
    JOIN "departments" department
      ON department.id = slice."departmentId"
    LEFT JOIN "asset_types" asset_type
      ON asset_type.id = task."referenceId"
     AND asset_type."companyId" = task."companyId"
    WHERE task."onboardingTemplateVersionId" = NEW.id
      AND (
        task."ownerType" IS NULL
        OR task."ownerType" NOT IN ('DEPARTMENT', 'EMPLOYEE', 'MANAGER')
        OR (
          task."ownerType" = 'DEPARTMENT'
          AND task."assignedDepartmentId" IS DISTINCT FROM slice."departmentId"
        )
        OR (
          task."ownerType" IN ('EMPLOYEE', 'MANAGER')
          AND task."assignedDepartmentId" IS NOT NULL
        )
        OR task."workType" NOT IN ('CHECKLIST', 'ASSET')
        OR slice."companyId" IS DISTINCT FROM NEW."companyId"
        OR department."companyId" IS DISTINCT FROM slice."companyId"
        OR department."branchId" IS DISTINCT FROM slice."branchId"
        OR task."approvalWorkflowId" IS NOT NULL
        OR task."assignedEmployeeId" IS NOT NULL
        OR task."assignedDesignationId" IS NOT NULL
        OR task."autoComplete" = true
        OR (
          task."workType" = 'CHECKLIST'
          AND (task."referenceType" IS NOT NULL OR task."referenceId" IS NOT NULL)
        )
        OR (
          task."workType" = 'ASSET'
          AND (
            task."ownerType" <> 'DEPARTMENT'
            OR task."referenceType" IS DISTINCT FROM 'ASSET_TYPE'
            OR asset_type.id IS NULL
            OR asset_type."isActive" = false
            OR asset_type."archivedAt" IS NOT NULL
            OR asset_type."trackingMode" NOT IN ('INDIVIDUAL', 'POOL')
          )
        )
        OR (
          task."allowSkip" = true
          AND EXISTS (
            SELECT 1
            FROM "OnboardingTemplateTask" dependent
            WHERE dependent."dependsOnTaskId" = task.id
              AND dependent."onboardingTemplateVersionId" = NEW.id
          )
        )
        OR (
          task."dependsOnTaskId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "OnboardingTemplateTask" prerequisite
            WHERE prerequisite.id = task."dependsOnTaskId"
              AND prerequisite."onboardingTemplateVersionId" = NEW.id
          )
        )
      );

    IF bad_tasks > 0 THEN
      RAISE EXCEPTION
        'ONBOARDING_TEMPLATE_PUBLISH_INVALID_TASKS:%', bad_tasks
        USING ERRCODE = 'restrict_violation';
    END IF;

    WITH RECURSIVE dependency_walk AS (
      SELECT
        task.id AS origin_id,
        task."dependsOnTaskId" AS next_id,
        ARRAY[task.id]::text[] AS path
      FROM "OnboardingTemplateTask" task
      WHERE task."onboardingTemplateVersionId" = NEW.id
        AND task."dependsOnTaskId" IS NOT NULL

      UNION ALL

      SELECT
        walk.origin_id,
        dependency."dependsOnTaskId" AS next_id,
        walk.path || dependency.id
      FROM dependency_walk walk
      JOIN "OnboardingTemplateTask" dependency
        ON dependency.id = walk.next_id
       AND dependency."onboardingTemplateVersionId" = NEW.id
      WHERE NOT dependency.id = ANY(walk.path)
        AND dependency."dependsOnTaskId" IS NOT NULL
    )
    SELECT EXISTS (
      SELECT 1
      FROM dependency_walk
      WHERE next_id = origin_id
    ) INTO has_cycle;

    IF has_cycle THEN
      RAISE EXCEPTION 'ONBOARDING_TEMPLATE_DEPENDENCY_CYCLE'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_template_version_publish_guard_trg
  ON "OnboardingTemplateVersion";
CREATE TRIGGER onboarding_template_version_publish_guard_trg
BEFORE UPDATE ON "OnboardingTemplateVersion"
FOR EACH ROW
EXECUTE FUNCTION onboarding_template_version_publish_guard();

-- ---------------------------------------------------------------------------
-- Onboarding Asset result tenant/employee containment
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "EmployeeOnboardingTask" task
  LEFT JOIN "employee_assets" custody
    ON custody.id = task."employeeAssetId"
  LEFT JOIN "software_license_allocations" allocation
    ON allocation.id = task."softwareLicenseAllocationId"
  WHERE (
      task."workType" = 'ASSET'
      AND COALESCE(task."statusV2"::text, task.status::text) = 'COMPLETED'
      AND task."employeeAssetId" IS NULL
      AND task."softwareLicenseAllocationId" IS NULL
    )
    OR (
      (
        task."resultType" IS NOT NULL
        OR task."employeeAssetId" IS NOT NULL
        OR task."softwareLicenseAllocationId" IS NOT NULL
      )
      AND (
        task."workType" <> 'ASSET'
        OR COALESCE(task."statusV2"::text, task.status::text) <> 'COMPLETED'
        OR task."resultType" IS NULL
        OR (
          task."resultType" = 'EMPLOYEE_ASSET'
          AND (
            task."employeeAssetId" IS NULL
            OR task."softwareLicenseAllocationId" IS NOT NULL
          )
        )
        OR (
          task."resultType" = 'SOFTWARE_LICENSE_ALLOCATION'
          AND (
            task."employeeAssetId" IS NOT NULL
            OR task."softwareLicenseAllocationId" IS NULL
          )
        )
      )
    )
    OR (
      task."employeeAssetId" IS NOT NULL
      AND (
        task."companyId" IS NULL
        OR task."employeeId" IS NULL
        OR custody.id IS NULL
        OR custody."companyId" IS DISTINCT FROM task."companyId"
        OR custody."employeeId" IS DISTINCT FROM task."employeeId"
      )
    )
    OR (
      task."softwareLicenseAllocationId" IS NOT NULL
      AND (
        task."companyId" IS NULL
        OR task."employeeId" IS NULL
        OR allocation.id IS NULL
        OR allocation."companyId" IS DISTINCT FROM task."companyId"
        OR allocation."employeeId" IS DISTINCT FROM task."employeeId"
      )
    );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'Onboarding Asset result hardening blocked: % invalid task result row(s) remain.',
      invalid_count;
  END IF;
END $$;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_employee_asset_result_fkey",
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_license_allocation_result_fkey",
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_asset_result_shape_check";

ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_employee_asset_result_fkey"
  FOREIGN KEY ("companyId", "employeeAssetId", "employeeId")
  REFERENCES "employee_assets" ("companyId", "id", "employeeId")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "EmployeeOnboardingTask_license_allocation_result_fkey"
  FOREIGN KEY ("companyId", "softwareLicenseAllocationId", "employeeId")
  REFERENCES "software_license_allocations" ("companyId", "id", "employeeId")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "EmployeeOnboardingTask_asset_result_shape_check"
  CHECK (
    (
      "resultType" IS NULL
      AND "employeeAssetId" IS NULL
      AND "softwareLicenseAllocationId" IS NULL
      AND NOT (
        "workType" = 'ASSET'
        AND COALESCE("statusV2"::text, status::text) = 'COMPLETED'
      )
    )
    OR (
      "workType" = 'ASSET'
      AND COALESCE("statusV2"::text, status::text) = 'COMPLETED'
      AND "resultType" = 'EMPLOYEE_ASSET'
      AND "employeeAssetId" IS NOT NULL
      AND "softwareLicenseAllocationId" IS NULL
    )
    OR (
      "workType" = 'ASSET'
      AND COALESCE("statusV2"::text, status::text) = 'COMPLETED'
      AND "resultType" = 'SOFTWARE_LICENSE_ALLOCATION'
      AND "employeeAssetId" IS NULL
      AND "softwareLicenseAllocationId" IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_employeeAssetId_idx"
  ON "EmployeeOnboardingTask" ("employeeAssetId")
  WHERE "employeeAssetId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_softwareLicenseAllocationId_idx"
  ON "EmployeeOnboardingTask" ("softwareLicenseAllocationId")
  WHERE "softwareLicenseAllocationId" IS NOT NULL;
