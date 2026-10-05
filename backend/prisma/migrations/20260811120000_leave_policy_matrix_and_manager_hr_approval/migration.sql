-- B0: Leave policy matrix uniqueness + Manager→HR workflow steps.
-- Additive. No new tables/columns. Does not rewrite leave rows, balances,
-- or existing approval transactions.
-- Idempotent: IF NOT EXISTS / NOT EXISTS guards.
-- Do not apply to dsp_erp_dev / shared RDS until duplicates are cleared
-- on a disposable database (see docs/product/leave-next-phase-block-b0-dry-run.md).

-- ---------------------------------------------------------------------------
-- 1. Partial unique indexes: one active policy per leave type at each scope
--    PostgreSQL treats NULLs as distinct in the existing 5-column unique, so
--    duplicate Branch-default / Branch+Dept / Branch+Designation rows are
--    possible today. These partial indexes close that gap.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_active_branch_default_uidx"
ON "leave_policies" ("companyId", "branchId", "leaveTypeId")
WHERE "isActive" = true
  AND "departmentId" IS NULL
  AND "designationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_active_branch_dept_uidx"
ON "leave_policies" ("companyId", "branchId", "departmentId", "leaveTypeId")
WHERE "isActive" = true
  AND "departmentId" IS NOT NULL
  AND "designationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_active_branch_designation_uidx"
ON "leave_policies" ("companyId", "branchId", "designationId", "leaveTypeId")
WHERE "isActive" = true
  AND "departmentId" IS NULL
  AND "designationId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_active_branch_dept_designation_uidx"
ON "leave_policies" ("companyId", "branchId", "departmentId", "designationId", "leaveTypeId")
WHERE "isActive" = true
  AND "departmentId" IS NOT NULL
  AND "designationId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Pending-approval queue helpers (no row rewrites)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "approval_transaction_steps_approverId_status_stepNo_idx"
ON "approval_transaction_steps" ("approverId", "status", "stepNo");

CREATE INDEX IF NOT EXISTS "leave_requests_status_submittedAt_idx"
ON "leave_requests" ("status", "submittedAt");

-- ---------------------------------------------------------------------------
-- 3. Global LEAVE_APPROVAL: ensure Step 2 HR (ROLE / HR_MANAGER)
--    Existing transactions are not updated.
-- ---------------------------------------------------------------------------

INSERT INTO "approval_workflow_steps" (
  "id", "workflowId", "stepNo", "approverType", "approverRole", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  aw."id",
  2,
  'ROLE',
  'HR_MANAGER',
  CURRENT_TIMESTAMP
FROM "approval_workflows" aw
WHERE aw."scopeKey" = 'GLOBAL:LEAVE_APPROVAL'
  AND aw."isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "approval_workflow_steps" s
    WHERE s."workflowId" = aw."id"
      AND s."stepNo" = 2
  );

-- ---------------------------------------------------------------------------
-- 4. Uncustomized one-step company LEAVE_APPROVAL workflows
--    (exactly one REPORTING_MANAGER step) get the same HR step.
--    Customized company workflows are left untouched.
-- ---------------------------------------------------------------------------

INSERT INTO "approval_workflow_steps" (
  "id", "workflowId", "stepNo", "approverType", "approverRole", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  aw."id",
  2,
  'ROLE',
  'HR_MANAGER',
  CURRENT_TIMESTAMP
FROM "approval_workflows" aw
WHERE aw."scopeKey" LIKE 'COMPANY:%:LEAVE_APPROVAL'
  AND aw."isActive" = true
  AND (
    SELECT COUNT(*)::int
    FROM "approval_workflow_steps" s
    WHERE s."workflowId" = aw."id"
  ) = 1
  AND EXISTS (
    SELECT 1
    FROM "approval_workflow_steps" s
    WHERE s."workflowId" = aw."id"
      AND s."stepNo" = 1
      AND s."approverType" = 'REPORTING_MANAGER'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "approval_workflow_steps" s
    WHERE s."workflowId" = aw."id"
      AND s."stepNo" = 2
  );
