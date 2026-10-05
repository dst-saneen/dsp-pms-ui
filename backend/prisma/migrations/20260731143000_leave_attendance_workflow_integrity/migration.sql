-- D3-02: leave_attendance_workflow_integrity
-- Preflight normalization + integrity constraints + BranchWorkingDay

-- ---------------------------------------------------------------------------
-- 1) Normalize Leave Request statuses (legacy PENDING -> SUBMITTED)
-- ---------------------------------------------------------------------------
UPDATE "leave_requests"
SET "status" = UPPER(TRIM("status"))
WHERE "status" IS NOT NULL;

UPDATE "leave_requests"
SET "status" = 'SUBMITTED'
WHERE "status" = 'PENDING';

-- Fail loudly if unknown leave statuses remain
DO $$
DECLARE
  unknown_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unknown_count
  FROM "leave_requests"
  WHERE "status" NOT IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

  IF unknown_count > 0 THEN
    RAISE EXCEPTION
      'leave_attendance_workflow_integrity: % leave_requests row(s) have unmapped status values',
      unknown_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Normalize Attendance status / source / approvalStatus
-- ---------------------------------------------------------------------------
UPDATE "attendances"
SET "status" = UPPER(TRIM("status"))
WHERE "status" IS NOT NULL;

UPDATE "attendances"
SET "source" = UPPER(TRIM("source"))
WHERE "source" IS NOT NULL;

UPDATE "attendances"
SET "approvalStatus" = UPPER(TRIM("approvalStatus"))
WHERE "approvalStatus" IS NOT NULL;

UPDATE "attendances"
SET "source" = 'MANUAL'
WHERE "source" IS NULL OR "source" = '';

UPDATE "attendances"
SET "approvalStatus" = 'APPROVED'
WHERE "approvalStatus" IS NULL OR "approvalStatus" = '';

DO $$
DECLARE
  unknown_status INTEGER;
  unknown_source INTEGER;
  unknown_approval INTEGER;
BEGIN
  SELECT COUNT(*) INTO unknown_status
  FROM "attendances"
  WHERE "status" NOT IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEK_OFF');

  SELECT COUNT(*) INTO unknown_source
  FROM "attendances"
  WHERE "source" NOT IN ('MANUAL', 'SELF_SERVICE', 'BIOMETRIC', 'IMPORT');

  SELECT COUNT(*) INTO unknown_approval
  FROM "attendances"
  WHERE "approvalStatus" NOT IN ('PENDING', 'APPROVED', 'REJECTED');

  IF unknown_status > 0 OR unknown_source > 0 OR unknown_approval > 0 THEN
    RAISE EXCEPTION
      'leave_attendance_workflow_integrity: unmapped attendance values (status=%, source=%, approval=%)',
      unknown_status, unknown_source, unknown_approval;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Preflight integrity detections (stop migration on bad data)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bad_leave_dates INTEGER;
  neg_balances INTEGER;
  bad_checkout INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_leave_dates
  FROM "leave_requests"
  WHERE "fromDate" > "toDate"
     OR "requestedDays" <= 0
     OR ("approvedDays" IS NOT NULL AND "approvedDays" < 0)
     OR (
       "isHalfDay" = TRUE
       AND (
         DATE("fromDate") <> DATE("toDate")
         OR "requestedDays" > 1
       )
     );

  SELECT COUNT(*) INTO neg_balances
  FROM "employee_leave_balances"
  WHERE "entitlement" < 0 OR "used" < 0 OR "pending" < 0;

  SELECT COUNT(*) INTO bad_checkout
  FROM "attendances"
  WHERE "checkInTime" IS NOT NULL
    AND "checkOutTime" IS NOT NULL
    AND "checkOutTime" < "checkInTime";

  IF bad_leave_dates > 0 OR neg_balances > 0 OR bad_checkout > 0 THEN
    RAISE EXCEPTION
      'leave_attendance_workflow_integrity: invalid rows (leave=%, balances=%, checkout=%)',
      bad_leave_dates, neg_balances, bad_checkout;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) LeaveRequest actor / timestamp columns
-- ---------------------------------------------------------------------------
ALTER TABLE "leave_requests"
ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rejectedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "leave_requests_employeeId_status_fromDate_idx"
  ON "leave_requests"("employeeId", "status", "fromDate");
CREATE INDEX IF NOT EXISTS "leave_requests_status_createdAt_idx"
  ON "leave_requests"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "leave_requests_leaveTypeId_status_idx"
  ON "leave_requests"("leaveTypeId", "status");
CREATE INDEX IF NOT EXISTS "leave_requests_fromDate_toDate_idx"
  ON "leave_requests"("fromDate", "toDate");
CREATE INDEX IF NOT EXISTS "leave_requests_approvedByUserId_idx"
  ON "leave_requests"("approvedByUserId");
CREATE INDEX IF NOT EXISTS "leave_requests_rejectedByUserId_idx"
  ON "leave_requests"("rejectedByUserId");
CREATE INDEX IF NOT EXISTS "leave_requests_cancelledByUserId_idx"
  ON "leave_requests"("cancelledByUserId");

ALTER TABLE "leave_requests"
  DROP CONSTRAINT IF EXISTS "leave_requests_approvedByUserId_fkey",
  DROP CONSTRAINT IF EXISTS "leave_requests_rejectedByUserId_fkey",
  DROP CONSTRAINT IF EXISTS "leave_requests_cancelledByUserId_fkey";

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "leave_requests_rejectedByUserId_fkey"
    FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "leave_requests_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
  DROP CONSTRAINT IF EXISTS "leave_requests_status_check",
  DROP CONSTRAINT IF EXISTS "leave_requests_date_range_check",
  DROP CONSTRAINT IF EXISTS "leave_requests_requested_days_check",
  DROP CONSTRAINT IF EXISTS "leave_requests_approved_days_check",
  DROP CONSTRAINT IF EXISTS "leave_requests_half_day_check";

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_status_check"
    CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  ADD CONSTRAINT "leave_requests_date_range_check"
    CHECK ("fromDate" <= "toDate"),
  ADD CONSTRAINT "leave_requests_requested_days_check"
    CHECK ("requestedDays" > 0),
  ADD CONSTRAINT "leave_requests_approved_days_check"
    CHECK ("approvedDays" IS NULL OR "approvedDays" >= 0),
  ADD CONSTRAINT "leave_requests_half_day_check"
    CHECK (
      "isHalfDay" = FALSE
      OR (
        DATE("fromDate") = DATE("toDate")
        AND "requestedDays" <= 1
      )
    );

-- ---------------------------------------------------------------------------
-- 5) EmployeeLeaveBalance non-negative field checks
-- ---------------------------------------------------------------------------
ALTER TABLE "employee_leave_balances"
  DROP CONSTRAINT IF EXISTS "employee_leave_balances_entitlement_check",
  DROP CONSTRAINT IF EXISTS "employee_leave_balances_used_check",
  DROP CONSTRAINT IF EXISTS "employee_leave_balances_pending_check";

ALTER TABLE "employee_leave_balances"
  ADD CONSTRAINT "employee_leave_balances_entitlement_check"
    CHECK ("entitlement" >= 0),
  ADD CONSTRAINT "employee_leave_balances_used_check"
    CHECK ("used" >= 0),
  ADD CONSTRAINT "employee_leave_balances_pending_check"
    CHECK ("pending" >= 0);

-- ---------------------------------------------------------------------------
-- 6) Attendance modifier columns + checks/indexes
-- ---------------------------------------------------------------------------
ALTER TABLE "attendances"
ADD COLUMN IF NOT EXISTS "lastModifiedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "lastModifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "attendances_attendanceDate_status_idx"
  ON "attendances"("attendanceDate", "status");
CREATE INDEX IF NOT EXISTS "attendances_employeeId_attendanceDate_isActive_idx"
  ON "attendances"("employeeId", "attendanceDate", "isActive");
CREATE INDEX IF NOT EXISTS "attendances_approvalStatus_attendanceDate_idx"
  ON "attendances"("approvalStatus", "attendanceDate");
CREATE INDEX IF NOT EXISTS "attendances_lastModifiedByUserId_idx"
  ON "attendances"("lastModifiedByUserId");

ALTER TABLE "attendances"
  DROP CONSTRAINT IF EXISTS "attendances_lastModifiedByUserId_fkey";

ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_lastModifiedByUserId_fkey"
    FOREIGN KEY ("lastModifiedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendances"
  DROP CONSTRAINT IF EXISTS "attendances_status_check",
  DROP CONSTRAINT IF EXISTS "attendances_source_check",
  DROP CONSTRAINT IF EXISTS "attendances_approval_status_check",
  DROP CONSTRAINT IF EXISTS "attendances_checkout_order_check",
  DROP CONSTRAINT IF EXISTS "attendances_worked_hours_check",
  DROP CONSTRAINT IF EXISTS "attendances_late_minutes_check",
  DROP CONSTRAINT IF EXISTS "attendances_early_minutes_check",
  DROP CONSTRAINT IF EXISTS "attendances_overtime_minutes_check";

ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_status_check"
    CHECK ("status" IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEK_OFF')),
  ADD CONSTRAINT "attendances_source_check"
    CHECK ("source" IS NULL OR "source" IN ('MANUAL', 'SELF_SERVICE', 'BIOMETRIC', 'IMPORT')),
  ADD CONSTRAINT "attendances_approval_status_check"
    CHECK ("approvalStatus" IS NULL OR "approvalStatus" IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT "attendances_checkout_order_check"
    CHECK (
      "checkInTime" IS NULL
      OR "checkOutTime" IS NULL
      OR "checkOutTime" >= "checkInTime"
    ),
  ADD CONSTRAINT "attendances_worked_hours_check"
    CHECK ("workedHours" >= 0),
  ADD CONSTRAINT "attendances_late_minutes_check"
    CHECK ("lateMinutes" >= 0),
  ADD CONSTRAINT "attendances_early_minutes_check"
    CHECK ("earlyDepartureMinutes" >= 0),
  ADD CONSTRAINT "attendances_overtime_minutes_check"
    CHECK ("overtimeMinutes" >= 0);

-- ---------------------------------------------------------------------------
-- 7) Branch working calendar review marker
-- ---------------------------------------------------------------------------
ALTER TABLE "branches"
ADD COLUMN IF NOT EXISTS "workingCalendarReviewedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 8) BranchWorkingDay table + Mon–Fri default backfill
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "branch_working_days" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "isWorkingDay" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_working_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "branch_working_days_branchId_dayOfWeek_key"
  ON "branch_working_days"("branchId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "branch_working_days_branchId_idx"
  ON "branch_working_days"("branchId");

ALTER TABLE "branch_working_days"
  DROP CONSTRAINT IF EXISTS "branch_working_days_dayOfWeek_check";

ALTER TABLE "branch_working_days"
  ADD CONSTRAINT "branch_working_days_dayOfWeek_check"
    CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6);

ALTER TABLE "branch_working_days"
  DROP CONSTRAINT IF EXISTS "branch_working_days_branchId_fkey";

ALTER TABLE "branch_working_days"
  ADD CONSTRAINT "branch_working_days_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "branch_working_days" ("id", "branchId", "dayOfWeek", "isWorkingDay", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || b."id" || d.day::text),
  b."id",
  d.day,
  CASE WHEN d.day BETWEEN 1 AND 5 THEN TRUE ELSE FALSE END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "branches" b
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS d(day)
WHERE NOT EXISTS (
  SELECT 1
  FROM "branch_working_days" existing
  WHERE existing."branchId" = b."id"
    AND existing."dayOfWeek" = d.day
);

DO $$
DECLARE
  branch_count INTEGER;
  calendar_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO branch_count FROM "branches";
  SELECT COUNT(*) INTO calendar_count FROM "branch_working_days";

  IF branch_count * 7 <> calendar_count THEN
    RAISE EXCEPTION
      'leave_attendance_workflow_integrity: expected % working-day rows, found %',
      branch_count * 7,
      calendar_count;
  END IF;
END $$;
