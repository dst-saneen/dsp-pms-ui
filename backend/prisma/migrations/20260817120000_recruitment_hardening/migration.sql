-- Recruitment production-hardening: uniqueness, headcount/score backstops,
-- encrypted offer-token storage, delivery attempts, public idempotency,
-- and early probation override permission.

CREATE TYPE "RecruitmentDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BYPASSED');

ALTER TABLE "job_offers"
  ADD COLUMN IF NOT EXISTS "responseTokenCiphertext" TEXT;

CREATE INDEX IF NOT EXISTS "job_offers_responseTokenHash_idx"
  ON "job_offers"("responseTokenHash");

DROP INDEX IF EXISTS "candidates_employeeId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_employeeId_key"
  ON "candidates"("employeeId");

DROP INDEX IF EXISTS "job_applications_employeeId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_employeeId_key"
  ON "job_applications"("employeeId");

ALTER TABLE "job_openings"
  DROP CONSTRAINT IF EXISTS "job_openings_headcount_nonneg";
ALTER TABLE "job_openings"
  ADD CONSTRAINT "job_openings_headcount_nonneg"
  CHECK ("headcountFilled" >= 0 AND "headcountReserved" >= 0 AND "headcountTotal" >= 1);

ALTER TABLE "job_openings"
  DROP CONSTRAINT IF EXISTS "job_openings_headcount_capacity";
ALTER TABLE "job_openings"
  ADD CONSTRAINT "job_openings_headcount_capacity"
  CHECK ("headcountFilled" + "headcountReserved" <= "headcountTotal");

ALTER TABLE "job_opening_criteria"
  DROP CONSTRAINT IF EXISTS "job_opening_criteria_weight_range";
ALTER TABLE "job_opening_criteria"
  ADD CONSTRAINT "job_opening_criteria_weight_range"
  CHECK ("weightPercent" >= 0 AND "weightPercent" <= 100);

ALTER TABLE "interview_evaluation_scores"
  DROP CONSTRAINT IF EXISTS "interview_evaluation_scores_score_range";
ALTER TABLE "interview_evaluation_scores"
  ADD CONSTRAINT "interview_evaluation_scores_score_range"
  CHECK ("score" >= 1 AND "score" <= 5);

ALTER TABLE "interview_evaluation_scores"
  DROP CONSTRAINT IF EXISTS "interview_evaluation_scores_weight_range";
ALTER TABLE "interview_evaluation_scores"
  ADD CONSTRAINT "interview_evaluation_scores_weight_range"
  CHECK ("weightPercentSnapshot" >= 0 AND "weightPercentSnapshot" <= 100);

CREATE UNIQUE INDEX IF NOT EXISTS "designation_onboarding_default_active_uidx"
  ON "designation_onboarding_assignments" ("designationId")
  WHERE "branchId" IS NULL AND "isActive" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "designation_onboarding_branch_active_uidx"
  ON "designation_onboarding_assignments" ("designationId", "branchId")
  WHERE "branchId" IS NOT NULL AND "isActive" = true;

CREATE TABLE IF NOT EXISTS "recruitment_delivery_attempts" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "RecruitmentDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptNo" INTEGER NOT NULL DEFAULT 1,
  "jobOfferId" TEXT,
  "jobApplicationId" TEXT,
  "candidateId" TEXT,
  "recipientKind" TEXT NOT NULL,
  "lastErrorCode" TEXT,
  "payloadCiphertext" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recruitment_delivery_attempts_jobOfferId_status_idx"
  ON "recruitment_delivery_attempts"("jobOfferId", "status");
CREATE INDEX IF NOT EXISTS "recruitment_delivery_attempts_jobApplicationId_status_idx"
  ON "recruitment_delivery_attempts"("jobApplicationId", "status");
CREATE INDEX IF NOT EXISTS "recruitment_delivery_attempts_eventType_status_idx"
  ON "recruitment_delivery_attempts"("eventType", "status");

ALTER TABLE "recruitment_delivery_attempts"
  ADD CONSTRAINT "recruitment_delivery_attempts_jobOfferId_fkey"
  FOREIGN KEY ("jobOfferId") REFERENCES "job_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recruitment_delivery_attempts"
  ADD CONSTRAINT "recruitment_delivery_attempts_jobApplicationId_fkey"
  FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recruitment_delivery_attempts"
  ADD CONSTRAINT "recruitment_delivery_attempts_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "public_application_idempotency" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "jobOpeningId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "jobApplicationId" TEXT,
  "responsePayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_application_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_application_idempotency_companyId_jobOpeningId_idempotencyKey_key"
  ON "public_application_idempotency"("companyId", "jobOpeningId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "public_application_idempotency_jobApplicationId_idx"
  ON "public_application_idempotency"("jobApplicationId");

ALTER TABLE "public_application_idempotency"
  ADD CONSTRAINT "public_application_idempotency_jobApplicationId_fkey"
  FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "updatedAt")
VALUES
  (
    md5('permission:hr.recruitment.probation.override'),
    'hr.recruitment.probation.override',
    'Override probation confirmation before planned end date',
    NULL,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO NOTHING;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'hr.recruitment.probation.override'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.probation.override')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"), r."id", p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;
