-- Onboarding V2 expand migration: enums, columns, action evidence, command receipts, permissions.

CREATE TYPE "EmployeeOnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EmployeeOnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'WAIVED', 'CANCELLED');
CREATE TYPE "OnboardingContractVersion" AS ENUM ('LEGACY_V1', 'V2');
CREATE TYPE "OnboardingTemplateResolutionSource" AS ENUM ('BRANCH_OVERRIDE', 'DESIGNATION_DEFAULT', 'DESIGNATION_LEGACY_FALLBACK', 'PRIVILEGED_OVERRIDE');
CREATE TYPE "OnboardingSourceType" AS ENUM ('RECRUITMENT_APPLICATION', 'MANUAL', 'LEGACY');
CREATE TYPE "OnboardingTaskResultType" AS ENUM ('EMPLOYEE_ASSET', 'SOFTWARE_LICENSE_ALLOCATION');
CREATE TYPE "OnboardingTaskActionType" AS ENUM ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED', 'STARTED', 'COMPLETED', 'OVERRIDE_COMPLETED', 'SKIPPED', 'AUTO_SKIPPED', 'REOPENED', 'WAIVED', 'CANCELLED');
CREATE TYPE "OnboardingActionAuthorityMode" AS ENUM ('NORMAL', 'HR_OVERRIDE', 'SYSTEM');
CREATE TYPE "OnboardingCommandType" AS ENUM (
  'CREATE_TEMPLATE', 'UPDATE_TEMPLATE', 'CREATE_TEMPLATE_DRAFT', 'WRITE_TEMPLATE_DRAFT',
  'VALIDATE_TEMPLATE_VERSION', 'PUBLISH_TEMPLATE_VERSION', 'ARCHIVE_TEMPLATE_VERSION', 'ARCHIVE_TEMPLATE',
  'CREATE_DESIGNATION_ASSIGNMENT', 'UPDATE_DESIGNATION_ASSIGNMENT', 'DEACTIVATE_DESIGNATION_ASSIGNMENT',
  'START', 'OVERRIDE_START', 'ASSIGN_TASK', 'UNASSIGN_TASK', 'START_TASK', 'COMPLETE_TASK',
  'SKIP_TASK', 'REOPEN_TASK', 'FULFILL_ASSET_TASK', 'WAIVE_TASK', 'COMPLETE_ONBOARDING', 'CANCEL_ONBOARDING'
);

-- OnboardingTemplate rowVersion
ALTER TABLE "OnboardingTemplate" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTemplate_companyId_id_key" ON "OnboardingTemplate" ("companyId", "id");

-- OnboardingTemplateVersion V2 columns
ALTER TABLE "OnboardingTemplateVersion" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "OnboardingTemplateVersion" ADD COLUMN IF NOT EXISTS "rowVersion" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTemplateVersion_companyId_id_key" ON "OnboardingTemplateVersion" ("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTemplateVersion_companyId_onboardingTemplateId_id_key" ON "OnboardingTemplateVersion" ("companyId", "onboardingTemplateId", "id");

-- EmployeeOnboarding V2 columns
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "branchTimeZoneAtStart" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "departmentIdAtStart" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "designationIdAtStart" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "designationOnboardingAssignmentId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "templateResolutionSource" "OnboardingTemplateResolutionSource";
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "sourceType" "OnboardingSourceType";
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "recruitmentApplicationId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "statusV2" "EmployeeOnboardingStatus";
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "contractVersion" "OnboardingContractVersion" NOT NULL DEFAULT 'LEGACY_V1';
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "skippedTasks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "waivedTasks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "terminalTasks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "mandatoryRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "startedByUserId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "overrideStartedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "overrideStartedByUserId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "overrideStartReason" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "overrideAutomaticTemplateId" TEXT;
ALTER TABLE "EmployeeOnboarding" ADD COLUMN IF NOT EXISTS "overrideResolutionFailureCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeOnboarding_companyId_id_key" ON "EmployeeOnboarding" ("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeOnboarding_companyId_id_employeeId_key" ON "EmployeeOnboarding" ("companyId", "id", "employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeOnboarding_companyId_branchId_status_idx" ON "EmployeeOnboarding" ("companyId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeOnboarding_sourceType_sourceId_idx" ON "EmployeeOnboarding" ("sourceType", "sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_onboarding_one_recruitment_source_idx"
ON "EmployeeOnboarding" ("recruitmentApplicationId")
WHERE "recruitmentApplicationId" IS NOT NULL;

-- EmployeeOnboardingTask V2 columns
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "workstreamDepartmentId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "executorDepartmentId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "statusV2" "EmployeeOnboardingTaskStatus";
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "contractVersion" "OnboardingContractVersion" NOT NULL DEFAULT 'LEGACY_V1';
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "templateVersionId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "resultType" "OnboardingTaskResultType";
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "employeeAssetId" TEXT;
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN IF NOT EXISTS "softwareLicenseAllocationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeOnboardingTask_companyId_id_key" ON "EmployeeOnboardingTask" ("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeOnboardingTask_companyId_id_employeeId_key" ON "EmployeeOnboardingTask" ("companyId", "id", "employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeOnboardingTask_companyId_onboardingId_id_key" ON "EmployeeOnboardingTask" ("companyId", "onboardingId", "id");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_companyId_branchId_executorDepartmentId_status_dueDate_idx"
ON "EmployeeOnboardingTask" ("companyId", "branchId", "executorDepartmentId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_companyId_status_nextReminderDate_idx"
ON "EmployeeOnboardingTask" ("companyId", "status", "nextReminderDate");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_employeeId_status_idx" ON "EmployeeOnboardingTask" ("employeeId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeOnboardingTask_executorDepartmentId_idx" ON "EmployeeOnboardingTask" ("executorDepartmentId");

-- Action evidence
CREATE TABLE IF NOT EXISTS "OnboardingTaskActionEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "action" "OnboardingTaskActionType" NOT NULL,
  "authorityMode" "OnboardingActionAuthorityMode" NOT NULL,
  "fromStatus" "EmployeeOnboardingTaskStatus",
  "toStatus" "EmployeeOnboardingTaskStatus" NOT NULL,
  "fromAssigneeUserId" TEXT,
  "toAssigneeUserId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT,
  "operationId" TEXT NOT NULL,
  "taskVersionBefore" INTEGER NOT NULL,
  "taskVersionAfter" INTEGER NOT NULL,
  "assetAttemptNo" INTEGER,
  "resultType" "OnboardingTaskResultType",
  "employeeAssetId" TEXT,
  "softwareLicenseAllocationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingTaskActionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTaskActionEvent_companyId_operationId_taskId_action_key"
ON "OnboardingTaskActionEvent" ("companyId", "operationId", "taskId", "action");
CREATE INDEX IF NOT EXISTS "OnboardingTaskActionEvent_taskId_createdAt_idx" ON "OnboardingTaskActionEvent" ("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "OnboardingTaskActionEvent_onboardingId_createdAt_idx" ON "OnboardingTaskActionEvent" ("onboardingId", "createdAt");

ALTER TABLE "OnboardingTaskActionEvent" ADD CONSTRAINT "OnboardingTaskActionEvent_onboardingId_fkey"
FOREIGN KEY ("onboardingId") REFERENCES "EmployeeOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingTaskActionEvent" ADD CONSTRAINT "OnboardingTaskActionEvent_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "EmployeeOnboardingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Command receipts
CREATE TABLE IF NOT EXISTS "OnboardingCommandReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "commandType" "OnboardingCommandType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestHashKeyVersion" TEXT NOT NULL,
  "requestHashFormatVersion" INTEGER NOT NULL DEFAULT 1,
  "resultEntityType" TEXT,
  "resultEntityId" TEXT,
  "safeResultSnapshot" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingCommandReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingCommandReceipt_companyId_operationId_key"
ON "OnboardingCommandReceipt" ("companyId", "operationId");
CREATE INDEX IF NOT EXISTS "OnboardingCommandReceipt_resultEntityType_resultEntityId_idx"
ON "OnboardingCommandReceipt" ("resultEntityType", "resultEntityId");

-- Designation assignment hardening
ALTER TABLE "designation_onboarding_assignments" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "designation_onboarding_assignments" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "designation_onboarding_assignments" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "designation_onboarding_assignments" ADD COLUMN IF NOT EXISTS "deactivatedByUserId" TEXT;
ALTER TABLE "designation_onboarding_assignments" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "designation_onboarding_assignments_companyId_id_key"
ON "designation_onboarding_assignments" ("companyId", "id");
CREATE INDEX IF NOT EXISTS "designation_onboarding_assignments_company_designation_branch_active_from_idx"
ON "designation_onboarding_assignments" ("companyId", "designationId", "branchId", "isActive", "effectiveFrom");

-- V2 permissions (tables are snake_case: permissions / roles / role_permissions)
INSERT INTO "permissions" ("id", "code", "name", "description", "updatedAt")
VALUES
  (md5('permission:hr.onboarding.publish'), 'hr.onboarding.publish', 'Publish onboarding templates', 'Publish and archive onboarding template versions', CURRENT_TIMESTAMP),
  (md5('permission:hr.onboarding.department.read'), 'hr.onboarding.department.read', 'View department onboarding queue', 'View department onboarding task queue', CURRENT_TIMESTAMP),
  (md5('permission:hr.onboarding.department.assign'), 'hr.onboarding.department.assign', 'Assign department onboarding tasks', 'Assign department onboarding tasks', CURRENT_TIMESTAMP),
  (md5('permission:hr.onboarding.override'), 'hr.onboarding.override', 'Override onboarding actions', 'Break-glass onboarding override actions', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'hr.onboarding.publish'),
    ('COMPANY_ADMINISTRATOR', 'hr.onboarding.publish')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"), r."id", p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;

-- Backfill version companyId from parent template
UPDATE "OnboardingTemplateVersion" v
SET "companyId" = t."companyId"
FROM "OnboardingTemplate" t
WHERE v."onboardingTemplateId" = t.id AND v."companyId" IS NULL;

UPDATE "designation_onboarding_assignments" a
SET "companyId" = d."companyId"
FROM "designations" d
WHERE a."designationId" = d.id AND a."companyId" IS NULL;
