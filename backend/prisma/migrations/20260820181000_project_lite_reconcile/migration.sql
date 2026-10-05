-- Project Lite Phase 2 reconcile (plan §9 step 2).
-- Deterministic statusV2 / type / snapshot backfill only.
-- Ambiguous statuses are left NULL for preflight/operator review.
-- Do not invent BusinessParty rows. Operator mapping is applied via script.

-- ---------------------------------------------------------------------------
-- Project statusV2
-- ---------------------------------------------------------------------------

UPDATE "projects"
SET "statusV2" = 'DRAFT'::"ProjectStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('DRAFT', 'PROPOSAL', 'APPROVED');

UPDATE "projects"
SET "statusV2" = 'ACTIVE'::"ProjectStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'ACTIVE';

UPDATE "projects"
SET "statusV2" = 'ON_HOLD'::"ProjectStatus"
WHERE "statusV2" IS NULL
  AND upper(replace(trim(status), ' ', '_')) IN ('ON_HOLD', 'ONHOLD');

UPDATE "projects"
SET "statusV2" = 'COMPLETED'::"ProjectStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('COMPLETED', 'CLOSED');

UPDATE "projects"
SET "statusV2" = 'CANCELLED'::"ProjectStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('CANCELLED', 'CANCELED');

-- Project type: CLIENT only when legacy client evidence exists
UPDATE "projects"
SET "projectType" = 'CLIENT'::"ProjectType"
WHERE "projectType" IS NULL
  AND (
    nullif(trim("clientName"), '') IS NOT NULL
    OR nullif(trim("clientContact"), '') IS NOT NULL
    OR "contractValue" IS NOT NULL
  );

UPDATE "projects"
SET "projectType" = 'INTERNAL'::"ProjectType"
WHERE "projectType" IS NULL;

-- Legacy snapshots (never overwrite filled V2 fields)
UPDATE "projects"
SET "expectedIncome" = "contractValue"
WHERE "expectedIncome" IS NULL
  AND "contractValue" IS NOT NULL;

UPDATE "projects"
SET "currencyCode" = currency
WHERE ("currencyCode" IS NULL OR trim("currencyCode") = '')
  AND nullif(trim(currency), '') IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Stage statusV2
-- ---------------------------------------------------------------------------

UPDATE "project_stages"
SET "statusV2" = 'PLANNED'::"ProjectStageStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('OPEN', 'PLANNED');

UPDATE "project_stages"
SET "statusV2" = 'ACTIVE'::"ProjectStageStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'ACTIVE';

UPDATE "project_stages"
SET "statusV2" = 'COMPLETED'::"ProjectStageStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'COMPLETED';

UPDATE "project_stages"
SET "statusV2" = 'CANCELLED'::"ProjectStageStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('CANCELLED', 'CANCELED');

-- ---------------------------------------------------------------------------
-- Task statusV2
-- ---------------------------------------------------------------------------

UPDATE "project_tasks"
SET "statusV2" = 'OPEN'::"ProjectTaskStatus"
WHERE "statusV2" IS NULL
  AND upper(replace(trim(status), ' ', '_')) IN ('NOT_STARTED', 'OPEN');

UPDATE "project_tasks"
SET "statusV2" = 'ASSIGNED'::"ProjectTaskStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'ASSIGNED';

UPDATE "project_tasks"
SET "statusV2" = 'IN_PROGRESS'::"ProjectTaskStatus"
WHERE "statusV2" IS NULL
  AND upper(replace(trim(status), ' ', '_')) IN ('IN_PROGRESS', 'INPROGRESS');

UPDATE "project_tasks"
SET "statusV2" = 'WAITING_REVIEW'::"ProjectTaskStatus"
WHERE "statusV2" IS NULL
  AND upper(replace(trim(status), ' ', '_')) IN ('WAITING_REVIEW', 'IN_REVIEW', 'REVIEW');

UPDATE "project_tasks"
SET "statusV2" = 'COMPLETED'::"ProjectTaskStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'COMPLETED';

UPDATE "project_tasks"
SET "statusV2" = 'CANCELLED'::"ProjectTaskStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('CANCELLED', 'CANCELED');

-- ---------------------------------------------------------------------------
-- Team / participant statusV2
-- ---------------------------------------------------------------------------

UPDATE "project_team_members"
SET "statusV2" = 'ENDED'::"ProjectTeamMemberStatus"
WHERE "statusV2" IS NULL
  AND (
    "isActive" = false
    OR upper(trim("allocationStatus")) IN ('ENDED', 'INACTIVE', 'REMOVED')
  );

UPDATE "project_team_members"
SET "statusV2" = 'ACTIVE'::"ProjectTeamMemberStatus"
WHERE "statusV2" IS NULL
  AND (
    "isActive" = true
    OR upper(trim("allocationStatus")) = 'ACTIVE'
  );

UPDATE "task_participants"
SET "statusV2" = 'ACTIVE'::"ProjectTaskParticipantStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('PENDING', 'ACTIVE');

UPDATE "task_participants"
SET "statusV2" = 'ENDED'::"ProjectTaskParticipantStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('ENDED', 'REMOVED', 'INACTIVE');

-- ---------------------------------------------------------------------------
-- Work logs
-- ---------------------------------------------------------------------------

UPDATE "work_log_headers"
SET "statusV2" = 'DRAFT'::"WorkLogStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'DRAFT';

UPDATE "work_log_headers"
SET "statusV2" = 'SUBMITTED'::"WorkLogStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'SUBMITTED';

UPDATE "work_log_headers"
SET "statusV2" = 'APPROVED'::"WorkLogStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'APPROVED';

UPDATE "work_log_headers"
SET "statusV2" = 'RETURNED'::"WorkLogStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('RETURNED', 'REJECTED');

UPDATE "work_log_headers"
SET "statusV2" = 'CANCELLED'::"WorkLogStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('CANCELLED', 'CANCELED');

UPDATE "work_log_headers"
SET
  "periodStart" = COALESCE("periodStart", "startDate"::date),
  "periodEnd" = COALESCE("periodEnd", "endDate"::date)
WHERE "periodStart" IS NULL
   OR "periodEnd" IS NULL;

-- ---------------------------------------------------------------------------
-- Submissions / reviews
-- ---------------------------------------------------------------------------

UPDATE "task_submissions"
SET "statusV2" = 'SUBMITTED'::"TaskSubmissionStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'SUBMITTED';

UPDATE "task_submissions"
SET "statusV2" = 'RETURNED'::"TaskSubmissionStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) = 'RETURNED';

UPDATE "task_submissions"
SET "statusV2" = 'ACCEPTED'::"TaskSubmissionStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('ACCEPTED', 'COMPLETED', 'APPROVED');

UPDATE "task_submissions"
SET "statusV2" = 'CANCELLED'::"TaskSubmissionStatus"
WHERE "statusV2" IS NULL
  AND upper(trim(status)) IN ('CANCELLED', 'CANCELED');

UPDATE "task_reviews"
SET "decisionV2" = 'RETURN'::"TaskReviewDecision"
WHERE "decisionV2" IS NULL
  AND upper(trim(decision)) IN ('RETURN', 'REJECT', 'REJECTED');

UPDATE "task_reviews"
SET "decisionV2" = 'COMPLETE'::"TaskReviewDecision"
WHERE "decisionV2" IS NULL
  AND upper(trim(decision)) IN ('COMPLETE', 'APPROVE', 'APPROVED', 'ACCEPT', 'ACCEPTED');

UPDATE "task_reviews"
SET "decisionV2" = 'CANCEL'::"TaskReviewDecision"
WHERE "decisionV2" IS NULL
  AND upper(trim(decision)) IN ('CANCEL', 'CANCELLED', 'CANCELED');

-- Re-assert company/project snapshots for any rows created between expand and reconcile
UPDATE "project_stages" s
SET "companyId" = p."companyId"
FROM "projects" p
WHERE s."projectId" = p."id" AND s."companyId" IS NULL;

UPDATE "project_tasks" t
SET "companyId" = p."companyId"
FROM "projects" p
WHERE t."projectId" = p."id" AND t."companyId" IS NULL;

UPDATE "project_team_members" m
SET "companyId" = p."companyId"
FROM "projects" p
WHERE m."projectId" = p."id" AND m."companyId" IS NULL;

UPDATE "task_participants" tp
SET
  "companyId" = t."companyId",
  "projectId" = t."projectId"
FROM "project_tasks" t
WHERE tp."taskId" = t."id"
  AND (tp."companyId" IS NULL OR tp."projectId" IS NULL);

UPDATE "task_submissions" s
SET
  "companyId" = t."companyId",
  "projectId" = t."projectId"
FROM "project_tasks" t
WHERE s."taskId" = t."id"
  AND (s."companyId" IS NULL OR s."projectId" IS NULL);

UPDATE "work_log_headers" h
SET
  "companyId" = e."companyId",
  "branchId" = e."branchId"
FROM "employees" e
WHERE h."employeeId" = e."id"
  AND (h."companyId" IS NULL OR h."branchId" IS NULL);

UPDATE "work_log_lines" l
SET
  "companyId" = h."companyId",
  "branchId" = h."branchId",
  "employeeId" = h."employeeId"
FROM "work_log_headers" h
WHERE l."workLogHeaderId" = h."id"
  AND (l."companyId" IS NULL OR l."branchId" IS NULL OR l."employeeId" IS NULL);
