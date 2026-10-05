-- HR Operations production hardening (expand -> reconcile -> contract).
-- Do not apply this migration until the companion preflight report is clean.

ALTER TYPE "FileUploadPurpose" ADD VALUE IF NOT EXISTS 'HR_REQUEST_ATTACHMENT';

-- Current-Lite capability catalog. IDs are deterministic so role mappings are
-- safe to replay; Company/Branch scope is still resolved from role assignment.
INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "updatedAt")
VALUES
  (md5('permission:hr.requests.read'), 'hr.requests.read', 'View HR requests', 'View Company-scoped HR requests.', true, CURRENT_TIMESTAMP),
  (md5('permission:hr.requests.manage'), 'hr.requests.manage', 'Manage HR requests', 'Manage Company-scoped HR requests and request types.', true, CURRENT_TIMESTAMP),
  (md5('permission:hr.requests.approve'), 'hr.requests.approve', 'Approve HR requests', 'Legacy compatibility permission; exact pending-step assignment remains authoritative.', true, CURRENT_TIMESTAMP),
  (md5('permission:hr.clearance.department.read'), 'hr.clearance.department.read', 'View department clearance work', 'View clearance work in the actor active department.', true, CURRENT_TIMESTAMP),
  (md5('permission:hr.clearance.department.manage'), 'hr.clearance.department.manage', 'Manage department clearance work', 'Clear department work in the actor active department.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "isTenantAssignable" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'hr.requests.read'),
    ('ORGANIZATION_OWNER', 'hr.requests.manage'),
    ('ORGANIZATION_OWNER', 'hr.requests.approve'),
    ('ORGANIZATION_OWNER', 'hr.clearance.department.read'),
    ('ORGANIZATION_OWNER', 'hr.clearance.department.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.requests.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.requests.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.requests.approve'),
    ('COMPANY_ADMINISTRATOR', 'hr.clearance.department.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.clearance.department.manage'),
    ('HR_MANAGER', 'hr.requests.read'),
    ('HR_MANAGER', 'hr.requests.manage'),
    ('HR_MANAGER', 'hr.requests.approve'),
    ('HR_MANAGER', 'hr.clearance.department.read'),
    ('HR_MANAGER', 'hr.clearance.department.manage')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT md5('role-permission:' || mapping."roleCode" || ':' || mapping."permissionCode"), role.id, permission.id
FROM mappings mapping
JOIN "roles" role ON role."code" = mapping."roleCode" AND role."isSystem" = true
JOIN "permissions" permission ON permission."code" = mapping."permissionCode"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

ALTER TABLE "hr_requests"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "fileObjectId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

ALTER TABLE "employee_separations"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;

ALTER TABLE "employee_clearances"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;

ALTER TABLE "employee_clearance_items"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "executorDepartmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "file_upload_sessions"
  ADD COLUMN IF NOT EXISTS "creatorUserId" TEXT;

CREATE TABLE IF NOT EXISTS "hr_command_receipts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "requestHmacKeyVersion" TEXT NOT NULL,
  "responseSnapshot" JSONB NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hr_command_receipts_pkey" PRIMARY KEY ("id")
);

-- Deterministic tenant/branch backfill from the immutable employee owner.
UPDATE "hr_requests" request
SET "companyId" = employee."companyId", "branchId" = employee."branchId"
FROM "employees" employee
WHERE request."employeeId" = employee.id
  AND (request."companyId" IS NULL OR request."branchId" IS NULL);

UPDATE "employee_separations" separation
SET "companyId" = employee."companyId", "branchId" = employee."branchId"
FROM "employees" employee
WHERE separation."employeeId" = employee.id
  AND (separation."companyId" IS NULL OR separation."branchId" IS NULL);

UPDATE "employee_clearances" clearance
SET "companyId" = separation."companyId", "branchId" = separation."branchId"
FROM "employee_separations" separation
WHERE clearance."separationId" = separation.id
  AND (clearance."companyId" IS NULL OR clearance."branchId" IS NULL);

UPDATE "employee_clearance_items" item
SET "companyId" = clearance."companyId", "branchId" = clearance."branchId"
FROM "employee_clearances" clearance
WHERE item."clearanceId" = clearance.id
  AND (item."companyId" IS NULL OR item."branchId" IS NULL);

-- Legacy manual items need reconciliation rather than a guessed department.
-- Asset summary rows are intentionally executor-less because Asset V2 owns them.
UPDATE "employee_clearance_items"
SET "executorDepartmentId" = NULL
WHERE "clearanceType" = 'ASSET';

UPDATE "file_upload_sessions" session
SET "creatorUserId" = object."creatorUserId"
FROM "file_objects" object
WHERE session."fileObjectId" = object.id
  AND session."creatorUserId" IS NULL;

UPDATE "hr_requests"
SET "status" = CASE "status"
  WHEN 'PENDING' THEN 'PENDING_APPROVAL'
  WHEN 'SUBMITTED' THEN 'PENDING_APPROVAL'
  ELSE "status"
END;

UPDATE "employee_separations"
SET "status" = CASE "status"
  WHEN 'SUBMITTED' THEN 'PENDING_APPROVAL'
  ELSE "status"
END;

ALTER TABLE "hr_requests"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

DO $$
DECLARE invalid_count integer;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "hr_requests" request
  LEFT JOIN "employees" employee ON employee.id = request."employeeId"
  LEFT JOIN "hr_request_types" type ON type.id = request."requestTypeId"
  LEFT JOIN "branches" branch ON branch.id = request."branchId"
  LEFT JOIN "file_objects" file ON file.id = request."fileObjectId"
  WHERE request."companyId" IS NULL
     OR request."branchId" IS NULL
     OR employee.id IS NULL
     OR type.id IS NULL
     OR employee."companyId" IS DISTINCT FROM request."companyId"
     OR employee."branchId" IS DISTINCT FROM request."branchId"
     OR type."companyId" IS DISTINCT FROM request."companyId"
     OR branch."companyId" IS DISTINCT FROM request."companyId"
     OR (file.id IS NOT NULL AND (file."companyId" IS DISTINCT FROM request."companyId" OR file."branchId" IS DISTINCT FROM request."branchId"))
     OR (request."status" = 'REJECTED' AND (request."rejectedAt" IS NULL OR request."rejectedByUserId" IS NULL))
     OR (request."status" = 'CANCELLED' AND (request."cancelledAt" IS NULL OR request."cancelledByUserId" IS NULL OR request."cancellationReason" IS NULL))
     OR (request."status" = 'COMPLETED' AND (request."completedAt" IS NULL OR request."completedByUserId" IS NULL))
     OR (request."approvalTransactionId" IS NOT NULL AND EXISTS (
       SELECT 1 FROM "hr_requests" duplicate
       WHERE duplicate."approvalTransactionId" = request."approvalTransactionId"
         AND duplicate.id <> request.id
     ))
     OR request."status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'HR Operations hardening blocked: % invalid HR Request row(s) require reconciliation.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "employee_separations" separation
  LEFT JOIN "employees" employee ON employee.id = separation."employeeId"
  LEFT JOIN "branches" branch ON branch.id = separation."branchId"
  WHERE separation."companyId" IS NULL
     OR separation."branchId" IS NULL
     OR employee.id IS NULL
     OR employee."companyId" IS DISTINCT FROM separation."companyId"
     OR employee."branchId" IS DISTINCT FROM separation."branchId"
     OR branch."companyId" IS DISTINCT FROM separation."companyId"
     OR (separation."status" = 'REJECTED' AND (separation."rejectedAt" IS NULL OR separation."rejectedByUserId" IS NULL))
     OR (separation."status" = 'CANCELLED' AND (separation."cancelledAt" IS NULL OR separation."cancelledByUserId" IS NULL OR separation."cancellationReason" IS NULL))
     OR (separation."status" = 'COMPLETED' AND (separation."completedDate" IS NULL OR separation."completedByUserId" IS NULL))
     OR separation."status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLEARANCE_IN_PROGRESS', 'CANCELLED', 'COMPLETED');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'HR Operations hardening blocked: % invalid Employee Separation row(s) require reconciliation.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "employee_clearances" clearance
  LEFT JOIN "employee_separations" separation ON separation.id = clearance."separationId"
  WHERE clearance."companyId" IS NULL
     OR clearance."branchId" IS NULL
     OR separation.id IS NULL
     OR separation."companyId" IS DISTINCT FROM clearance."companyId"
     OR separation."branchId" IS DISTINCT FROM clearance."branchId"
     OR (clearance."status" = 'COMPLETED' AND (clearance."completedDate" IS NULL OR clearance."completedByUserId" IS NULL))
     OR (clearance."status" <> 'COMPLETED' AND (clearance."completedDate" IS NOT NULL OR clearance."completedByUserId" IS NOT NULL))
     OR clearance."status" NOT IN ('PENDING', 'IN_PROGRESS', 'COMPLETED');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'HR Operations hardening blocked: % invalid Employee Clearance row(s) require reconciliation.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "employee_clearance_items" item
  LEFT JOIN "employee_clearances" clearance ON clearance.id = item."clearanceId"
  LEFT JOIN "departments" department ON department.id = item."executorDepartmentId"
  LEFT JOIN "employees" clearer ON clearer.id = item."clearedById"
  WHERE item."companyId" IS NULL
     OR item."branchId" IS NULL
     OR clearance.id IS NULL
     OR clearance."companyId" IS DISTINCT FROM item."companyId"
     OR clearance."branchId" IS DISTINCT FROM item."branchId"
     OR (item."clearanceType" = 'ASSET' AND item."executorDepartmentId" IS NOT NULL)
     OR (item."clearanceType" IN ('HR', 'FINANCE', 'IT', 'ADMIN') AND item."executorDepartmentId" IS NULL)
     OR (item."executorDepartmentId" IS NOT NULL AND (department."companyId" IS DISTINCT FROM item."companyId" OR department."branchId" IS DISTINCT FROM item."branchId"))
     OR (item."clearedById" IS NOT NULL AND (clearer.id IS NULL OR clearer."companyId" IS DISTINCT FROM item."companyId"))
     OR (item."status" = 'CLEARED' AND item."clearedDate" IS NULL)
     OR (item."status" = 'CLEARED' AND item."clearanceType" IN ('HR', 'FINANCE', 'IT', 'ADMIN') AND item."clearedById" IS NULL)
     OR (item."status" = 'PENDING' AND (item."clearedDate" IS NOT NULL OR item."clearedById" IS NOT NULL))
     OR item."clearanceType" NOT IN ('ASSET', 'HR', 'FINANCE', 'IT', 'ADMIN')
     OR item."status" NOT IN ('PENDING', 'CLEARED');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'HR Operations hardening blocked: % invalid Clearance Item row(s) require reconciliation.', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "file_upload_sessions" session
  WHERE session."publicSessionTokenHash" IS NULL
    AND session."creatorUserId" IS NULL
    AND session."status" IN ('ISSUED', 'UPLOADED', 'FINALIZING', 'CLEAN');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'HR Operations hardening blocked: % legacy authenticated upload session(s) have no creator and must be expired or reconciled.', invalid_count;
  END IF;
END $$;

ALTER TABLE "hr_requests"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "employee_separations"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "employee_clearances"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "employee_clearance_items"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL;

-- Every composite foreign-key target must have a matching unique key before
-- the contract constraints below are added.
CREATE UNIQUE INDEX IF NOT EXISTS "hr_request_types_companyId_id_key"
  ON "hr_request_types" ("companyId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "hr_requests_companyId_id_key"
  ON "hr_requests" ("companyId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "hr_requests_approvalTransactionId_key"
  ON "hr_requests" ("approvalTransactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_separations_companyId_id_key"
  ON "employee_separations" ("companyId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "employee_clearances_companyId_id_key"
  ON "employee_clearances" ("companyId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "employee_clearances_companyId_separationId_key"
  ON "employee_clearances" ("companyId", "separationId");
CREATE UNIQUE INDEX IF NOT EXISTS "file_objects_companyId_branchId_id_key"
  ON "file_objects" ("companyId", "branchId", id);

ALTER TABLE "hr_requests"
  DROP CONSTRAINT IF EXISTS "hr_requests_requestNo_key",
  ADD CONSTRAINT "hr_requests_companyId_requestNo_key" UNIQUE ("companyId", "requestNo"),
  ADD CONSTRAINT "hr_requests_status_check" CHECK ("status" IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  ADD CONSTRAINT "hr_requests_terminal_evidence_check" CHECK (
    ("status" = 'REJECTED' AND "rejectedAt" IS NOT NULL AND "rejectedByUserId" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL AND "cancellationReason" IS NOT NULL)
    OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completedByUserId" IS NOT NULL)
    OR "status" NOT IN ('REJECTED', 'CANCELLED', 'COMPLETED')
  ),
  ADD CONSTRAINT "hr_requests_company_employee_fkey" FOREIGN KEY ("companyId", "employeeId") REFERENCES "employees" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_company_type_fkey" FOREIGN KEY ("companyId", "requestTypeId") REFERENCES "hr_request_types" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_approval_transaction_fkey" FOREIGN KEY ("approvalTransactionId") REFERENCES "approval_transactions" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_company_branch_file_fkey" FOREIGN KEY ("companyId", "branchId", "fileObjectId") REFERENCES "file_objects" ("companyId", "branchId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_created_by_user_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_approved_by_user_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_rejected_by_user_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_completed_by_user_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_requests_cancelled_by_user_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "employee_separations"
  ADD CONSTRAINT "employee_separations_status_check" CHECK ("status" IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLEARANCE_IN_PROGRESS', 'CANCELLED', 'COMPLETED')),
  ADD CONSTRAINT "employee_separations_terminal_evidence_check" CHECK (
    ("status" = 'REJECTED' AND "rejectedAt" IS NOT NULL AND "rejectedByUserId" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL AND "cancellationReason" IS NOT NULL)
    OR ("status" = 'COMPLETED' AND "completedDate" IS NOT NULL AND "completedByUserId" IS NOT NULL)
    OR "status" NOT IN ('REJECTED', 'CANCELLED', 'COMPLETED')
  ),
  ADD CONSTRAINT "employee_separations_company_employee_fkey" FOREIGN KEY ("companyId", "employeeId") REFERENCES "employees" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_separations_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_separations_created_by_user_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_separations_approved_by_user_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_separations_rejected_by_user_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_separations_cancelled_by_user_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_separations_completed_by_user_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "employee_clearances"
  ADD CONSTRAINT "employee_clearances_status_check" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  ADD CONSTRAINT "employee_clearances_terminal_evidence_check" CHECK (
    ("status" = 'COMPLETED' AND "completedDate" IS NOT NULL AND "completedByUserId" IS NOT NULL)
    OR ("status" <> 'COMPLETED' AND "completedDate" IS NULL AND "completedByUserId" IS NULL)
  ),
  ADD CONSTRAINT "employee_clearances_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_clearances_company_separation_fkey" FOREIGN KEY ("companyId", "separationId") REFERENCES "employee_separations" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_clearances_completed_by_user_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "employee_clearance_items"
  ADD CONSTRAINT "employee_clearance_items_shape_check" CHECK (
    ("clearanceType" = 'ASSET' AND "executorDepartmentId" IS NULL)
    OR ("clearanceType" IN ('HR', 'FINANCE', 'IT', 'ADMIN') AND "executorDepartmentId" IS NOT NULL)
  ),
  ADD CONSTRAINT "employee_clearance_items_status_check" CHECK ("status" IN ('PENDING', 'CLEARED')),
  ADD CONSTRAINT "employee_clearance_items_terminal_evidence_check" CHECK (
    ("status" = 'CLEARED' AND "clearanceType" = 'ASSET' AND "clearedDate" IS NOT NULL)
    OR ("status" = 'CLEARED' AND "clearanceType" IN ('HR', 'FINANCE', 'IT', 'ADMIN') AND "clearedDate" IS NOT NULL AND "clearedById" IS NOT NULL)
    OR ("status" = 'PENDING' AND "clearedDate" IS NULL AND "clearedById" IS NULL)
  ),
  ADD CONSTRAINT "employee_clearance_items_company_clearance_fkey" FOREIGN KEY ("companyId", "clearanceId") REFERENCES "employee_clearances" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_clearance_items_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_clearance_items_company_cleared_by_fkey" FOREIGN KEY ("companyId", "clearedById") REFERENCES "employees" ("companyId", id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_clearance_items_company_department_fkey" FOREIGN KEY ("companyId", "branchId", "executorDepartmentId") REFERENCES "departments" ("companyId", "branchId", id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_creator_user_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "users" (id) ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "hr_command_receipts"
  ADD CONSTRAINT "hr_command_receipts_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "hr_command_receipts_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users" (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS "hr_command_receipts_companyId_operationId_key" ON "hr_command_receipts" ("companyId", "operationId");
CREATE INDEX IF NOT EXISTS "hr_command_receipts_companyId_commandType_idx" ON "hr_command_receipts" ("companyId", "commandType");
CREATE INDEX IF NOT EXISTS "hr_requests_companyId_branchId_status_idx" ON "hr_requests" ("companyId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "hr_requests_employeeId_status_idx" ON "hr_requests" ("employeeId", "status");
CREATE INDEX IF NOT EXISTS "employee_separations_companyId_branchId_status_idx" ON "employee_separations" ("companyId", "branchId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_separations_one_open_per_employee_idx"
  ON "employee_separations" ("employeeId")
  WHERE "status" IN ('PENDING_APPROVAL', 'APPROVED', 'CLEARANCE_IN_PROGRESS');
CREATE INDEX IF NOT EXISTS "employee_clearances_companyId_branchId_status_idx" ON "employee_clearances" ("companyId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "employee_clearance_items_queue_idx" ON "employee_clearance_items" ("companyId", "branchId", "executorDepartmentId", "status");
CREATE INDEX IF NOT EXISTS "file_upload_sessions_creatorUserId_status_idx" ON "file_upload_sessions" ("creatorUserId", "status");
