-- D2-02: employee_onboarding_snapshot_and_asset_integrity
-- Preflight normalization, backfill, integrity indexes and checks.

-- ============================================================================
-- 1. Preflight: normalize unknown Asset statuses
-- ============================================================================
UPDATE "assets"
SET "status" = 'AVAILABLE'
WHERE "status" IS NULL
   OR "status" NOT IN ('AVAILABLE', 'ASSIGNED', 'REPAIR', 'DISPOSED', 'LOST');

UPDATE "employee_assets"
SET "status" = 'ASSIGNED'
WHERE "returnedDate" IS NULL
  AND ("status" IS NULL OR "status" NOT IN ('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED'));

UPDATE "employee_assets"
SET "status" = 'RETURNED'
WHERE "returnedDate" IS NOT NULL
  AND ("status" IS NULL OR "status" NOT IN ('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED'));

-- Close duplicate active assignments (keep earliest)
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "assetId" ORDER BY "assignedDate" ASC, "createdAt" ASC) AS rn
  FROM "employee_assets"
  WHERE "status" = 'ASSIGNED'
    AND "returnedDate" IS NULL
)
UPDATE "employee_assets" ea
SET
  "status" = 'RETURNED',
  "returnedDate" = CURRENT_TIMESTAMP,
  "remarks" = COALESCE(ea."remarks", '') || ' [auto-closed duplicate active assignment]'
FROM ranked r
WHERE ea."id" = r."id"
  AND r.rn > 1;

-- Align asset master with active assignments
UPDATE "assets" a
SET "status" = 'ASSIGNED'
WHERE EXISTS (
  SELECT 1
  FROM "employee_assets" ea
  WHERE ea."assetId" = a."id"
    AND ea."status" = 'ASSIGNED'
    AND ea."returnedDate" IS NULL
)
AND a."status" <> 'ASSIGNED';

UPDATE "assets" a
SET "status" = 'AVAILABLE'
WHERE a."status" = 'ASSIGNED'
  AND NOT EXISTS (
    SELECT 1
    FROM "employee_assets" ea
    WHERE ea."assetId" = a."id"
      AND ea."status" = 'ASSIGNED'
      AND ea."returnedDate" IS NULL
  );

-- Close duplicate IN_PROGRESS onboardings (keep earliest)
WITH ranked_onboarding AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "employeeId" ORDER BY "startDate" ASC, "createdAt" ASC) AS rn
  FROM "EmployeeOnboarding"
  WHERE "status" = 'IN_PROGRESS'
)
UPDATE "EmployeeOnboarding" eo
SET "status" = 'CANCELLED'
FROM ranked_onboarding r
WHERE eo."id" = r."id"
  AND r.rn > 1;

UPDATE "EmployeeOnboardingTask" eot
SET "status" = 'CANCELLED'
WHERE eot."status" NOT IN ('COMPLETED', 'CANCELLED')
  AND eot."onboardingId" IN (
    SELECT "id" FROM "EmployeeOnboarding" WHERE "status" = 'CANCELLED'
  );

-- Normalize document verification statuses
UPDATE "employee_documents"
SET "verificationStatus" = 'PENDING'
WHERE "verificationStatus" IS NULL
   OR "verificationStatus" NOT IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- ============================================================================
-- 2. EmployeeOnboarding.templateVersionId (nullable first)
-- ============================================================================
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "templateVersionId" TEXT;

-- Link to current published version of the same template
UPDATE "EmployeeOnboarding" eo
SET "templateVersionId" = v."id"
FROM "OnboardingTemplateVersion" v
WHERE eo."templateVersionId" IS NULL
  AND v."onboardingTemplateId" = eo."templateId"
  AND v."isCurrent" = true
  AND v."status" = 'PUBLISHED';

-- Link to latest published version if no current
UPDATE "EmployeeOnboarding" eo
SET "templateVersionId" = sub."id"
FROM (
  SELECT DISTINCT ON (v."onboardingTemplateId")
    v."id",
    v."onboardingTemplateId"
  FROM "OnboardingTemplateVersion" v
  WHERE v."status" = 'PUBLISHED'
  ORDER BY v."onboardingTemplateId", v."versionNo" DESC
) sub
WHERE eo."templateVersionId" IS NULL
  AND sub."onboardingTemplateId" = eo."templateId";

-- Create frozen ARCHIVED version for templates without any version
INSERT INTO "OnboardingTemplateVersion" (
  "id",
  "onboardingTemplateId",
  "versionNo",
  "versionName",
  "status",
  "isCurrent",
  "effectiveFrom",
  "publishedAt",
  "changeSummary",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  t."id",
  1,
  'Frozen migration snapshot',
  'ARCHIVED',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'Auto-created during employee_onboarding_snapshot_and_asset_integrity migration',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "OnboardingTemplate" t
WHERE NOT EXISTS (
  SELECT 1 FROM "OnboardingTemplateVersion" v WHERE v."onboardingTemplateId" = t."id"
)
AND EXISTS (
  SELECT 1 FROM "EmployeeOnboarding" eo WHERE eo."templateId" = t."id" AND eo."templateVersionId" IS NULL
);

UPDATE "EmployeeOnboarding" eo
SET "templateVersionId" = v."id"
FROM "OnboardingTemplateVersion" v
WHERE eo."templateVersionId" IS NULL
  AND v."onboardingTemplateId" = eo."templateId"
  AND v."versionName" = 'Frozen migration snapshot';

-- Any remaining orphan onboardings: create per-template frozen version from latest versionNo+1
INSERT INTO "OnboardingTemplateVersion" (
  "id",
  "onboardingTemplateId",
  "versionNo",
  "versionName",
  "status",
  "isCurrent",
  "effectiveFrom",
  "publishedAt",
  "changeSummary",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  eo."templateId",
  COALESCE((
    SELECT MAX(v."versionNo") FROM "OnboardingTemplateVersion" v WHERE v."onboardingTemplateId" = eo."templateId"
  ), 0) + 1,
  'Frozen migration snapshot',
  'ARCHIVED',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'Auto-created for orphan onboarding during integrity migration',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "EmployeeOnboarding" eo
WHERE eo."templateVersionId" IS NULL
GROUP BY eo."templateId";

UPDATE "EmployeeOnboarding" eo
SET "templateVersionId" = v."id"
FROM "OnboardingTemplateVersion" v
WHERE eo."templateVersionId" IS NULL
  AND v."onboardingTemplateId" = eo."templateId"
  AND v."versionName" = 'Frozen migration snapshot'
  AND v."status" = 'ARCHIVED';

-- Fail migration if any null remains
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "EmployeeOnboarding" WHERE "templateVersionId" IS NULL) THEN
    RAISE EXCEPTION 'Backfill failed: EmployeeOnboarding.templateVersionId still null';
  END IF;
END $$;

ALTER TABLE "EmployeeOnboarding" ALTER COLUMN "templateVersionId" SET NOT NULL;

-- ============================================================================
-- 3. EmployeeOnboardingTask snapshot fields
-- ============================================================================
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "sourceTemplateTaskId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "dependsOnTaskId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "allowSkip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "allowReopen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "assignedDepartmentId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "assignedDesignationId" TEXT;

-- ============================================================================
-- 4. EmployeeDocument.verifiedByUserId
-- ============================================================================
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "verifiedByUserId" TEXT;

UPDATE "employee_documents" d
SET "verifiedByUserId" = u."id"
FROM "users" u
WHERE d."verifiedByUserId" IS NULL
  AND d."verifiedBy" IS NOT NULL
  AND (
    u."id" = d."verifiedBy"
    OR u."username" = d."verifiedBy"
    OR u."email" = d."verifiedBy"
  );

-- ============================================================================
-- 5. Foreign keys
-- ============================================================================
ALTER TABLE "EmployeeOnboarding"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboarding_templateVersionId_fkey";
ALTER TABLE "EmployeeOnboarding"
  ADD CONSTRAINT "EmployeeOnboarding_templateVersionId_fkey"
  FOREIGN KEY ("templateVersionId") REFERENCES "OnboardingTemplateVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OnboardingTemplateVersion"
  DROP CONSTRAINT IF EXISTS "OnboardingTemplateVersion_publishedByUserId_fkey";
ALTER TABLE "OnboardingTemplateVersion"
  ADD CONSTRAINT "OnboardingTemplateVersion_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_sourceTemplateTaskId_fkey";
ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_sourceTemplateTaskId_fkey"
  FOREIGN KEY ("sourceTemplateTaskId") REFERENCES "OnboardingTemplateTask"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_dependsOnTaskId_fkey";
ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_dependsOnTaskId_fkey"
  FOREIGN KEY ("dependsOnTaskId") REFERENCES "EmployeeOnboardingTask"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_assignedDepartmentId_fkey";
ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_assignedDepartmentId_fkey"
  FOREIGN KEY ("assignedDepartmentId") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_assignedDesignationId_fkey";
ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_assignedDesignationId_fkey"
  FOREIGN KEY ("assignedDesignationId") REFERENCES "designations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_assignedToUserId_fkey";
ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboardingTask"
  DROP CONSTRAINT IF EXISTS "EmployeeOnboardingTask_completedByUserId_fkey";
ALTER TABLE "EmployeeOnboardingTask"
  ADD CONSTRAINT "EmployeeOnboardingTask_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_documents"
  DROP CONSTRAINT IF EXISTS "employee_documents_verifiedByUserId_fkey";
ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 6. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS "EmployeeOnboarding_companyId_status_idx" ON "EmployeeOnboarding"("companyId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeOnboarding_employeeId_status_idx" ON "EmployeeOnboarding"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeOnboarding_templateVersionId_idx" ON "EmployeeOnboarding"("templateVersionId");

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeOnboarding_one_in_progress_per_employee_idx"
  ON "EmployeeOnboarding"("employeeId")
  WHERE "status" = 'IN_PROGRESS';

CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_onboardingId_status_idx" ON "EmployeeOnboardingTask"("onboardingId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_assignedToUserId_status_dueDate_idx" ON "EmployeeOnboardingTask"("assignedToUserId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_sourceTemplateTaskId_idx" ON "EmployeeOnboardingTask"("sourceTemplateTaskId");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_dependsOnTaskId_idx" ON "EmployeeOnboardingTask"("dependsOnTaskId");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_assignedDepartmentId_idx" ON "EmployeeOnboardingTask"("assignedDepartmentId");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_assignedDesignationId_idx" ON "EmployeeOnboardingTask"("assignedDesignationId");

CREATE INDEX IF NOT EXISTS "OnboardingTemplateVersion_publishedByUserId_idx" ON "OnboardingTemplateVersion"("publishedByUserId");

CREATE INDEX IF NOT EXISTS "employee_documents_employeeId_verificationStatus_idx" ON "employee_documents"("employeeId", "verificationStatus");
CREATE INDEX IF NOT EXISTS "employee_documents_expiryDate_verificationStatus_idx" ON "employee_documents"("expiryDate", "verificationStatus");
CREATE INDEX IF NOT EXISTS "employee_documents_verifiedByUserId_idx" ON "employee_documents"("verifiedByUserId");

CREATE INDEX IF NOT EXISTS "employee_assets_employeeId_status_idx" ON "employee_assets"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "employee_assets_assetId_status_idx" ON "employee_assets"("assetId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_assets_one_active_assignment_per_asset_idx"
  ON "employee_assets"("assetId")
  WHERE "status" = 'ASSIGNED' AND "returnedDate" IS NULL;

-- ============================================================================
-- 7. CHECK constraints
-- ============================================================================
ALTER TABLE "employee_documents" DROP CONSTRAINT IF EXISTS "employee_documents_verificationStatus_check";
ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_verificationStatus_check"
  CHECK ("verificationStatus" IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'));

ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_status_check";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_status_check"
  CHECK ("status" IN ('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED'));

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_status_check";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_status_check"
  CHECK ("status" IN ('AVAILABLE', 'ASSIGNED', 'REPAIR', 'DISPOSED', 'LOST'));
