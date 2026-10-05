-- Template contract: restrict cascades, one-current-published uniqueness,
-- composite FKs, and draft-only child mutation backstops.

ALTER TABLE "OnboardingTemplateVersion"
  DROP CONSTRAINT IF EXISTS "OnboardingTemplateVersion_onboardingTemplateId_fkey";

ALTER TABLE "OnboardingTemplateVersion"
  ADD CONSTRAINT "OnboardingTemplateVersion_onboardingTemplateId_fkey"
  FOREIGN KEY ("onboardingTemplateId") REFERENCES "OnboardingTemplate"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "OnboardingDepartmentTemplate"
  DROP CONSTRAINT IF EXISTS "OnboardingDepartmentTemplate_onboardingTemplateVersionId_fkey";

ALTER TABLE "OnboardingDepartmentTemplate"
  ADD CONSTRAINT "OnboardingDepartmentTemplate_onboardingTemplateVersionId_fkey"
  FOREIGN KEY ("onboardingTemplateVersionId") REFERENCES "OnboardingTemplateVersion"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "OnboardingDepartmentTemplate"
  DROP CONSTRAINT IF EXISTS "OnboardingDepartmentTemplate_departmentId_fkey";

ALTER TABLE "OnboardingDepartmentTemplate"
  ADD CONSTRAINT "OnboardingDepartmentTemplate_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "OnboardingTaskGroup"
  DROP CONSTRAINT IF EXISTS "OnboardingTaskGroup_onboardingDepartmentTemplateId_fkey";

ALTER TABLE "OnboardingTaskGroup"
  ADD CONSTRAINT "OnboardingTaskGroup_onboardingDepartmentTemplateId_fkey"
  FOREIGN KEY ("onboardingDepartmentTemplateId") REFERENCES "OnboardingDepartmentTemplate"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "OnboardingTaskGroup"
  DROP CONSTRAINT IF EXISTS "OnboardingTaskGroup_onboardingTemplateVersionId_fkey";

ALTER TABLE "OnboardingTaskGroup"
  ADD CONSTRAINT "OnboardingTaskGroup_onboardingTemplateVersionId_fkey"
  FOREIGN KEY ("onboardingTemplateVersionId") REFERENCES "OnboardingTemplateVersion"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "OnboardingTemplateTask"
  DROP CONSTRAINT IF EXISTS "OnboardingTemplateTask_taskGroupId_fkey";

ALTER TABLE "OnboardingTemplateTask"
  ADD CONSTRAINT "OnboardingTemplateTask_taskGroupId_fkey"
  FOREIGN KEY ("taskGroupId") REFERENCES "OnboardingTaskGroup"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "OnboardingTemplateTask"
  DROP CONSTRAINT IF EXISTS "OnboardingTemplateTask_onboardingTemplateVersionId_fkey";

ALTER TABLE "OnboardingTemplateTask"
  ADD CONSTRAINT "OnboardingTemplateTask_onboardingTemplateVersionId_fkey"
  FOREIGN KEY ("onboardingTemplateVersionId") REFERENCES "OnboardingTemplateVersion"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_template_one_current_published_idx"
ON "OnboardingTemplateVersion" ("onboardingTemplateId")
WHERE status = 'PUBLISHED' AND "isCurrent" = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingDepartmentTemplate_company_version_fkey'
  ) THEN
    ALTER TABLE "OnboardingDepartmentTemplate"
      ADD CONSTRAINT "OnboardingDepartmentTemplate_company_version_fkey"
      FOREIGN KEY ("companyId", "onboardingTemplateVersionId")
      REFERENCES "OnboardingTemplateVersion" ("companyId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingDepartmentTemplate_company_branch_department_fkey'
  ) THEN
    ALTER TABLE "OnboardingDepartmentTemplate"
      ADD CONSTRAINT "OnboardingDepartmentTemplate_company_branch_department_fkey"
      FOREIGN KEY ("companyId", "branchId", "departmentId")
      REFERENCES "departments" ("companyId", "branchId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTaskGroup_company_version_id_fkey'
  ) THEN
    ALTER TABLE "OnboardingTaskGroup"
      ADD CONSTRAINT "OnboardingTaskGroup_company_version_id_fkey"
      FOREIGN KEY ("companyId", "onboardingTemplateVersionId", "onboardingDepartmentTemplateId")
      REFERENCES "OnboardingDepartmentTemplate" ("companyId", "onboardingTemplateVersionId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTemplateTask_company_version_group_fkey'
  ) THEN
    ALTER TABLE "OnboardingTemplateTask"
      ADD CONSTRAINT "OnboardingTemplateTask_company_version_group_fkey"
      FOREIGN KEY ("companyId", "onboardingTemplateVersionId", "taskGroupId")
      REFERENCES "OnboardingTaskGroup" ("companyId", "onboardingTemplateVersionId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTemplateTask_company_version_dependency_fkey'
  ) THEN
    ALTER TABLE "OnboardingTemplateTask"
      ADD CONSTRAINT "OnboardingTemplateTask_company_version_dependency_fkey"
      FOREIGN KEY ("companyId", "onboardingTemplateVersionId", "dependsOnTaskId")
      REFERENCES "OnboardingTemplateTask" ("companyId", "onboardingTemplateVersionId", "id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION onboarding_reject_immutable_template_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_status "TemplateVersionStatus";
BEGIN
  IF TG_TABLE_NAME = 'OnboardingDepartmentTemplate' THEN
    SELECT v.status INTO version_status
    FROM "OnboardingTemplateVersion" v
    WHERE v.id = COALESCE(NEW."onboardingTemplateVersionId", OLD."onboardingTemplateVersionId");
  ELSIF TG_TABLE_NAME = 'OnboardingTaskGroup' THEN
    SELECT v.status INTO version_status
    FROM "OnboardingDepartmentTemplate" d
    JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
    WHERE d.id = COALESCE(NEW."onboardingDepartmentTemplateId", OLD."onboardingDepartmentTemplateId");
  ELSE
    SELECT v.status INTO version_status
    FROM "OnboardingTaskGroup" g
    JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
    JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
    WHERE g.id = COALESCE(NEW."taskGroupId", OLD."taskGroupId");
  END IF;

  IF version_status IS NOT NULL AND version_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Published and archived template versions are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_department_template_immutable_trg ON "OnboardingDepartmentTemplate";
CREATE TRIGGER onboarding_department_template_immutable_trg
BEFORE UPDATE OR DELETE ON "OnboardingDepartmentTemplate"
FOR EACH ROW
EXECUTE FUNCTION onboarding_reject_immutable_template_child();

DROP TRIGGER IF EXISTS onboarding_task_group_immutable_trg ON "OnboardingTaskGroup";
CREATE TRIGGER onboarding_task_group_immutable_trg
BEFORE UPDATE OR DELETE ON "OnboardingTaskGroup"
FOR EACH ROW
EXECUTE FUNCTION onboarding_reject_immutable_template_child();

DROP TRIGGER IF EXISTS onboarding_template_task_immutable_trg ON "OnboardingTemplateTask";
CREATE TRIGGER onboarding_template_task_immutable_trg
BEFORE UPDATE OR DELETE ON "OnboardingTemplateTask"
FOR EACH ROW
EXECUTE FUNCTION onboarding_reject_immutable_template_child();
