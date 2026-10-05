-- Idempotent backfill for recruitment rollout

UPDATE "employees"
SET "creationSource" = 'LEGACY_IMPORT'
WHERE "creationSource" IS NULL OR "sourceCandidateId" IS NULL;

INSERT INTO "employee_career_events" (
  "id",
  "employeeId",
  "eventType",
  "eventAt",
  "employeeVisibleSummary",
  "hrDetailReference",
  "sourceModule",
  "sourceRecordId",
  "createdAt"
)
SELECT
  md5('legacy-baseline:' || e."id"),
  e."id",
  'EMPLOYEE_CREATED',
  COALESCE(e."joiningDate", e."createdAt"),
  'Employee record established',
  'LEGACY_IMPORT_BASELINE',
  'migration',
  e."id",
  CURRENT_TIMESTAMP
FROM "employees" e
WHERE NOT EXISTS (
  SELECT 1 FROM "employee_career_events" c
  WHERE c."employeeId" = e."id"
    AND c."sourceModule" = 'migration'
    AND c."sourceRecordId" = e."id"
);

INSERT INTO "designation_onboarding_assignments" (
  "id",
  "designationId",
  "branchId",
  "onboardingTemplateId",
  "effectiveFrom",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('designation-onboarding-default:' || d."id"),
  d."id",
  NULL,
  d."onboardingTemplateId",
  CURRENT_TIMESTAMP,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "designations" d
WHERE d."onboardingTemplateId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "designation_onboarding_assignments" a
    WHERE a."designationId" = d."id"
      AND a."branchId" IS NULL
      AND a."isActive" = true
  );
