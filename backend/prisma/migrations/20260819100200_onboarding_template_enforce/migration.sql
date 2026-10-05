-- Enforce Template tenant snapshots after preflight is clean.
-- Fails closed if nullable containment remains.

DO $$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n
  FROM "OnboardingTemplateVersion" v
  JOIN "OnboardingTemplate" t ON t.id = v."onboardingTemplateId"
  WHERE v."companyId" IS NULL OR v."companyId" <> t."companyId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Template enforce blocked: % version company mismatches remain.', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM "OnboardingDepartmentTemplate" d
  LEFT JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
  LEFT JOIN "OnboardingTemplate" t ON t.id = v."onboardingTemplateId"
  LEFT JOIN "departments" dep ON dep.id = d."departmentId"
  WHERE d."companyId" IS NULL
     OR d."branchId" IS NULL
     OR t."companyId" IS DISTINCT FROM dep."companyId"
     OR d."branchId" IS DISTINCT FROM dep."branchId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Template enforce blocked: % department slice snapshot gaps remain.', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM "OnboardingTaskGroup" g
  JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
  WHERE g."companyId" IS NULL
     OR g."onboardingTemplateVersionId" IS NULL
     OR g."companyId" IS DISTINCT FROM d."companyId"
     OR g."onboardingTemplateVersionId" IS DISTINCT FROM d."onboardingTemplateVersionId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Template enforce blocked: % task group containment gaps remain.', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM "OnboardingTemplateTask" task
  JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
  WHERE task."companyId" IS NULL
     OR task."onboardingTemplateVersionId" IS NULL
     OR task."companyId" IS DISTINCT FROM g."companyId"
     OR task."onboardingTemplateVersionId" IS DISTINCT FROM g."onboardingTemplateVersionId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Template enforce blocked: % template task containment gaps remain.', n;
  END IF;
END $$;

UPDATE "OnboardingDepartmentTemplate" d
SET
  "companyId" = t."companyId",
  "branchId" = dep."branchId"
FROM "OnboardingTemplateVersion" v,
     "OnboardingTemplate" t,
     "departments" dep
WHERE d."onboardingTemplateVersionId" = v.id
  AND t.id = v."onboardingTemplateId"
  AND dep.id = d."departmentId"
  AND (d."companyId" IS NULL OR d."branchId" IS NULL);

UPDATE "OnboardingTaskGroup" g
SET
  "companyId" = d."companyId",
  "onboardingTemplateVersionId" = d."onboardingTemplateVersionId"
FROM "OnboardingDepartmentTemplate" d
WHERE g."onboardingDepartmentTemplateId" = d.id
  AND (g."companyId" IS NULL OR g."onboardingTemplateVersionId" IS NULL);

UPDATE "OnboardingTemplateTask" task
SET
  "companyId" = g."companyId",
  "onboardingTemplateVersionId" = g."onboardingTemplateVersionId"
FROM "OnboardingTaskGroup" g
WHERE task."taskGroupId" = g.id
  AND (task."companyId" IS NULL OR task."onboardingTemplateVersionId" IS NULL);

ALTER TABLE "OnboardingTemplateVersion"
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "OnboardingDepartmentTemplate"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "OnboardingTaskGroup"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "onboardingTemplateVersionId" SET NOT NULL;

ALTER TABLE "OnboardingTemplateTask"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "onboardingTemplateVersionId" SET NOT NULL;

CREATE OR REPLACE FUNCTION designation_onboarding_assignment_overlap_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count integer;
BEGIN
  IF NEW."isActive" = false THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO overlap_count
  FROM designation_onboarding_assignments existing
  WHERE existing."designationId" = NEW."designationId"
    AND existing.id <> NEW.id
    AND existing."isActive" = true
    AND (
      (NEW."branchId" IS NULL AND existing."branchId" IS NULL)
      OR (NEW."branchId" IS NOT NULL AND existing."branchId" = NEW."branchId")
    )
    AND existing."effectiveFrom" <= COALESCE(NEW."effectiveTo", '9999-12-31'::timestamp)
    AND NEW."effectiveFrom" <= COALESCE(existing."effectiveTo", '9999-12-31'::timestamp);

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Overlapping active designation onboarding assignment'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS designation_onboarding_assignment_overlap_trg
  ON designation_onboarding_assignments;
CREATE TRIGGER designation_onboarding_assignment_overlap_trg
BEFORE INSERT OR UPDATE ON designation_onboarding_assignments
FOR EACH ROW
EXECUTE FUNCTION designation_onboarding_assignment_overlap_guard();

CREATE OR REPLACE FUNCTION onboarding_template_version_publish_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bad_tasks integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'PUBLISHED'
     AND OLD.status = 'DRAFT' THEN
    SELECT COUNT(*) INTO bad_tasks
    FROM "OnboardingTemplateTask" task
    WHERE task."onboardingTemplateVersionId" = NEW.id
      AND (
        task."ownerType" IS NULL
        OR task."ownerType" NOT IN ('DEPARTMENT', 'EMPLOYEE', 'MANAGER')
        OR task."workType" NOT IN ('CHECKLIST', 'ASSET')
        OR task."approvalWorkflowId" IS NOT NULL
        OR task."assignedEmployeeId" IS NOT NULL
        OR task."assignedDesignationId" IS NOT NULL
        OR task."autoComplete" = true
      );

    IF bad_tasks > 0 THEN
      RAISE EXCEPTION 'Published template version contains % invalid task row(s).', bad_tasks
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
