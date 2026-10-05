-- Project Lite Phase 1 expand (plan §9 step 1).
-- Additive only: enums, nullable snapshots/versions/evidence, receipts/events/documents.
-- Do not drop legacy columns, rename projectmanagerId, or enforce NOT NULL / composite FKs here.
-- businessPartyId is nullable TEXT without FK until Office Finance creates BusinessParty.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "ProjectType" AS ENUM ('CLIENT', 'INTERNAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectStageStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectTaskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_REVIEW', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectTeamMemberStatus" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectTaskParticipantStatus" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkLogStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectActionEntityType" AS ENUM (
    'PROJECT', 'STAGE', 'TEAM_MEMBER', 'TASK', 'TASK_PARTICIPANT',
    'TASK_SUBMISSION', 'WORK_LOG', 'PROJECT_DOCUMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskSubmissionStatus" AS ENUM ('SUBMITTED', 'RETURNED', 'ACCEPTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskReviewDecision" AS ENUM ('RETURN', 'COMPLETE', 'CANCEL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "FileUploadPurpose" ADD VALUE IF NOT EXISTS 'PROJECT_SUPPORTING';
ALTER TYPE "FileRetentionClass" ADD VALUE IF NOT EXISTS 'PROJECT_RECORD';

-- ---------------------------------------------------------------------------
-- Supporting composite uniqueness (for later company-qualified FKs)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "employees_companyId_id_key"
  ON "employees"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "projects_companyId_id_key"
  ON "projects"("companyId", "id");

-- ---------------------------------------------------------------------------
-- Project
-- ---------------------------------------------------------------------------

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "projectType" "ProjectType";
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "statusV2" "ProjectStatus";
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "businessPartyId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "expectedIncome" DECIMAL(18,2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "expenseBudget" DECIMAL(18,2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "activatedByUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "heldAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "heldByUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "holdReason" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "resumedByUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

CREATE INDEX IF NOT EXISTS "projects_companyId_status_idx"
  ON "projects"("companyId", "status");
CREATE INDEX IF NOT EXISTS "projects_companyId_statusV2_idx"
  ON "projects"("companyId", "statusV2");
CREATE INDEX IF NOT EXISTS "projects_companyId_projectmanagerId_idx"
  ON "projects"("companyId", "projectmanagerId");
CREATE INDEX IF NOT EXISTS "projects_businessPartyId_idx"
  ON "projects"("businessPartyId");

CREATE INDEX IF NOT EXISTS "projects_companyId_projectCode_idx"
  ON "projects"("companyId", "projectCode");

-- ---------------------------------------------------------------------------
-- ProjectStage
-- ---------------------------------------------------------------------------

ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "statusV2" "ProjectStageStatus";
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "activatedByUserId" TEXT;
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "project_stages" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

UPDATE "project_stages" s
SET "companyId" = p."companyId"
FROM "projects" p
WHERE s."projectId" = p."id" AND s."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "project_stages_companyId_projectId_idx"
  ON "project_stages"("companyId", "projectId");
CREATE INDEX IF NOT EXISTS "project_stages_companyId_statusV2_idx"
  ON "project_stages"("companyId", "statusV2");

-- ---------------------------------------------------------------------------
-- ProjectTask
-- ---------------------------------------------------------------------------

ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "statusV2" "ProjectTaskStatus";
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "submittedForReviewAt" TIMESTAMP(3);
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "submittedForReviewByUserId" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "returnedByUserId" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "returnReason" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT;

UPDATE "project_tasks" t
SET "companyId" = p."companyId"
FROM "projects" p
WHERE t."projectId" = p."id" AND t."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "project_tasks_companyId_projectId_status_idx"
  ON "project_tasks"("companyId", "projectId", "status");
CREATE INDEX IF NOT EXISTS "project_tasks_companyId_stageId_idx"
  ON "project_tasks"("companyId", "stageId");
CREATE INDEX IF NOT EXISTS "project_tasks_companyId_statusV2_dueDate_idx"
  ON "project_tasks"("companyId", "statusV2", "dueDate");
CREATE INDEX IF NOT EXISTS "project_tasks_parentTaskId_idx"
  ON "project_tasks"("parentTaskId");

-- ---------------------------------------------------------------------------
-- ProjectTeamMember
-- ---------------------------------------------------------------------------

ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "statusV2" "ProjectTeamMemberStatus";
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT;
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "endedByUserId" TEXT;
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "endReason" TEXT;

UPDATE "project_team_members" m
SET "companyId" = p."companyId"
FROM "projects" p
WHERE m."projectId" = p."id" AND m."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "project_team_members_companyId_projectId_idx"
  ON "project_team_members"("companyId", "projectId");
CREATE INDEX IF NOT EXISTS "project_team_members_companyId_employeeId_idx"
  ON "project_team_members"("companyId", "employeeId");
CREATE INDEX IF NOT EXISTS "project_team_members_statusV2_idx"
  ON "project_team_members"("statusV2");

-- ---------------------------------------------------------------------------
-- ProjectTeamMemberHistory
-- ---------------------------------------------------------------------------

ALTER TABLE "project_team_member_history" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "project_team_member_history" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;
ALTER TABLE "project_team_member_history" ADD COLUMN IF NOT EXISTS "operationId" TEXT;
ALTER TABLE "project_team_member_history" ADD COLUMN IF NOT EXISTS "protectedReason" TEXT;

UPDATE "project_team_member_history" h
SET "companyId" = p."companyId"
FROM "projects" p
WHERE h."projectId" = p."id" AND h."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "project_team_member_history_companyId_projectId_idx"
  ON "project_team_member_history"("companyId", "projectId");
CREATE INDEX IF NOT EXISTS "project_team_member_history_operationId_idx"
  ON "project_team_member_history"("operationId");

-- ---------------------------------------------------------------------------
-- TaskParticipant
-- ---------------------------------------------------------------------------

ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "statusV2" "ProjectTaskParticipantStatus";
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT;
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "endedByUserId" TEXT;
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "task_participants" ADD COLUMN IF NOT EXISTS "endReason" TEXT;

UPDATE "task_participants" tp
SET
  "companyId" = t."companyId",
  "projectId" = t."projectId"
FROM "project_tasks" t
WHERE tp."taskId" = t."id"
  AND (tp."companyId" IS NULL OR tp."projectId" IS NULL);

CREATE INDEX IF NOT EXISTS "task_participants_companyId_projectId_idx"
  ON "task_participants"("companyId", "projectId");
CREATE INDEX IF NOT EXISTS "task_participants_companyId_employeeId_statusV2_idx"
  ON "task_participants"("companyId", "employeeId", "statusV2");

-- ---------------------------------------------------------------------------
-- TaskAssignmentHistory
-- ---------------------------------------------------------------------------

ALTER TABLE "task_assignment_history" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "task_assignment_history" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "task_assignment_history" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;
ALTER TABLE "task_assignment_history" ADD COLUMN IF NOT EXISTS "operationId" TEXT;

UPDATE "task_assignment_history" h
SET
  "companyId" = t."companyId",
  "projectId" = t."projectId"
FROM "project_tasks" t
WHERE h."taskId" = t."id"
  AND (h."companyId" IS NULL OR h."projectId" IS NULL);

CREATE INDEX IF NOT EXISTS "task_assignment_history_companyId_projectId_idx"
  ON "task_assignment_history"("companyId", "projectId");

-- ---------------------------------------------------------------------------
-- TaskSubmission / TaskReview
-- ---------------------------------------------------------------------------

ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "statusV2" "TaskSubmissionStatus";
ALTER TABLE "task_submissions" ADD COLUMN IF NOT EXISTS "submittedByUserId" TEXT;
ALTER TABLE "task_submissions" ALTER COLUMN "filePath" DROP NOT NULL;

UPDATE "task_submissions" s
SET
  "companyId" = t."companyId",
  "projectId" = t."projectId"
FROM "project_tasks" t
WHERE s."taskId" = t."id"
  AND (s."companyId" IS NULL OR s."projectId" IS NULL);

CREATE INDEX IF NOT EXISTS "task_submissions_companyId_projectId_idx"
  ON "task_submissions"("companyId", "projectId");

ALTER TABLE "task_reviews" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "task_reviews" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "task_reviews" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "task_reviews" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "task_reviews" ADD COLUMN IF NOT EXISTS "decisionV2" "TaskReviewDecision";
ALTER TABLE "task_reviews" ADD COLUMN IF NOT EXISTS "reviewerUserId" TEXT;

UPDATE "task_reviews" r
SET
  "companyId" = s."companyId",
  "projectId" = s."projectId",
  "taskId" = s."taskId"
FROM "task_submissions" s
WHERE r."submissionId" = s."id"
  AND (r."companyId" IS NULL OR r."projectId" IS NULL OR r."taskId" IS NULL);

CREATE INDEX IF NOT EXISTS "task_reviews_companyId_projectId_idx"
  ON "task_reviews"("companyId", "projectId");

-- ---------------------------------------------------------------------------
-- WorkLogHeader / WorkLogLine
-- ---------------------------------------------------------------------------

ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "statusV2" "WorkLogStatus";
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "periodStart" DATE;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "periodEnd" DATE;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "reportingManagerEmployeeId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "reportingManagerUserId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "submittedByUserId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "returnedByUserId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "returnReason" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "work_log_headers" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

UPDATE "work_log_headers" h
SET
  "companyId" = e."companyId",
  "branchId" = e."branchId",
  "periodStart" = COALESCE(h."periodStart", h."startDate"::date),
  "periodEnd" = COALESCE(h."periodEnd", h."endDate"::date)
FROM "employees" e
WHERE h."employeeId" = e."id"
  AND (h."companyId" IS NULL OR h."branchId" IS NULL OR h."periodStart" IS NULL OR h."periodEnd" IS NULL);

CREATE INDEX IF NOT EXISTS "work_log_headers_companyId_employeeId_periodStart_idx"
  ON "work_log_headers"("companyId", "employeeId", "periodStart");
CREATE INDEX IF NOT EXISTS "work_log_headers_companyId_statusV2_idx"
  ON "work_log_headers"("companyId", "statusV2");
CREATE INDEX IF NOT EXISTS "work_log_headers_reportingManagerUserId_statusV2_idx"
  ON "work_log_headers"("reportingManagerUserId", "statusV2");

ALTER TABLE "work_log_lines" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "work_log_lines" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "work_log_lines" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "work_log_lines" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "work_log_lines" l
SET
  "companyId" = h."companyId",
  "branchId" = h."branchId",
  "employeeId" = h."employeeId"
FROM "work_log_headers" h
WHERE l."workLogHeaderId" = h."id"
  AND (l."companyId" IS NULL OR l."branchId" IS NULL OR l."employeeId" IS NULL);

CREATE INDEX IF NOT EXISTS "work_log_lines_companyId_employeeId_workDate_idx"
  ON "work_log_lines"("companyId", "employeeId", "workDate");
CREATE INDEX IF NOT EXISTS "work_log_lines_companyId_taskId_idx"
  ON "work_log_lines"("companyId", "taskId");

-- ---------------------------------------------------------------------------
-- ProjectActionEvent
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "project_action_events" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityType" "ProjectActionEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "projectId" TEXT,
  "fromState" TEXT,
  "toState" TEXT,
  "actorUserId" TEXT NOT NULL,
  "versionBefore" INTEGER,
  "versionAfter" INTEGER,
  "operationId" TEXT NOT NULL,
  "protectedReason" TEXT,
  "protectedNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_action_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_action_events_companyId_entityType_entityId_idx"
  ON "project_action_events"("companyId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "project_action_events_companyId_projectId_createdAt_idx"
  ON "project_action_events"("companyId", "projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "project_action_events_companyId_operationId_idx"
  ON "project_action_events"("companyId", "operationId");

ALTER TABLE "project_action_events"
  DROP CONSTRAINT IF EXISTS "project_action_events_companyId_fkey";
ALTER TABLE "project_action_events"
  ADD CONSTRAINT "project_action_events_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_action_events"
  DROP CONSTRAINT IF EXISTS "project_action_events_actorUserId_fkey";
ALTER TABLE "project_action_events"
  ADD CONSTRAINT "project_action_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ProjectCommandReceipt
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "project_command_receipts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestHashKeyVersion" TEXT NOT NULL,
  "requestHashFormatVersion" INTEGER NOT NULL DEFAULT 1,
  "resultEntityType" TEXT,
  "resultEntityId" TEXT,
  "safeResultSnapshot" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_command_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_command_receipts_companyId_operationId_key"
  ON "project_command_receipts"("companyId", "operationId");
CREATE INDEX IF NOT EXISTS "project_command_receipts_companyId_commandType_idx"
  ON "project_command_receipts"("companyId", "commandType");
CREATE INDEX IF NOT EXISTS "project_command_receipts_resultEntityType_resultEntityId_idx"
  ON "project_command_receipts"("resultEntityType", "resultEntityId");

ALTER TABLE "project_command_receipts"
  DROP CONSTRAINT IF EXISTS "project_command_receipts_companyId_fkey";
ALTER TABLE "project_command_receipts"
  ADD CONSTRAINT "project_command_receipts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_command_receipts"
  DROP CONSTRAINT IF EXISTS "project_command_receipts_actorUserId_fkey";
ALTER TABLE "project_command_receipts"
  ADD CONSTRAINT "project_command_receipts_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ProjectDocument
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "project_documents" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "taskSubmissionId" TEXT,
  "fileObjectId" TEXT NOT NULL,
  "documentPurpose" TEXT NOT NULL,
  "title" TEXT,
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_documents_companyId_fileObjectId_key"
  ON "project_documents"("companyId", "fileObjectId");
CREATE INDEX IF NOT EXISTS "project_documents_companyId_projectId_idx"
  ON "project_documents"("companyId", "projectId");
CREATE INDEX IF NOT EXISTS "project_documents_companyId_taskId_idx"
  ON "project_documents"("companyId", "taskId");
CREATE INDEX IF NOT EXISTS "project_documents_taskSubmissionId_idx"
  ON "project_documents"("taskSubmissionId");

ALTER TABLE "project_documents"
  DROP CONSTRAINT IF EXISTS "project_documents_companyId_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_documents"
  DROP CONSTRAINT IF EXISTS "project_documents_projectId_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_documents"
  DROP CONSTRAINT IF EXISTS "project_documents_taskId_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_documents"
  DROP CONSTRAINT IF EXISTS "project_documents_taskSubmissionId_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_taskSubmissionId_fkey"
  FOREIGN KEY ("taskSubmissionId") REFERENCES "task_submissions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_documents"
  DROP CONSTRAINT IF EXISTS "project_documents_fileObjectId_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "file_objects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_documents"
  DROP CONSTRAINT IF EXISTS "project_documents_uploadedByUserId_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
