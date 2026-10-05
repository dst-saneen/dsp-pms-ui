-- CreateEnum
CREATE TYPE "DayPortion" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "LeaveTypeCategory" AS ENUM ('STANDARD', 'UNPAID', 'COMP_OFF');

-- CreateEnum
CREATE TYPE "ShiftRosterStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShiftRosterDayType" AS ENUM ('WORKING', 'WEEK_OFF', 'HOLIDAY', 'SCHEDULED_HALF_DAY');

-- CreateEnum
CREATE TYPE "ShiftRosterEntrySource" AS ENUM ('GENERATED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "AttendanceExceptionType" AS ENUM ('LATE', 'EARLY_DEPARTURE', 'MISSING_CHECK_IN', 'MISSING_CHECK_OUT', 'INSUFFICIENT_HOURS', 'UNSCHEDULED_WORK', 'SHIFT_MISMATCH');

-- CreateEnum
CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttendanceRegularizationStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendancePeriodStatus" AS ENUM ('OPEN', 'REVIEW', 'LOCKED', 'PAYROLL_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeaveBalanceTransactionType" AS ENUM ('OPENING_SNAPSHOT', 'ENTITLEMENT', 'ACCRUAL', 'CARRY_FORWARD', 'RESERVATION', 'CONSUMPTION', 'REVERSAL', 'ADJUSTMENT', 'EXPIRY');

-- CreateEnum
CREATE TYPE "OvertimeRoundingMode" AS ENUM ('DOWN');

-- CreateEnum
CREATE TYPE "OvertimeSettlementType" AS ENUM ('COMP_OFF', 'PAYROLL_PENDING');

-- CreateEnum
CREATE TYPE "OvertimeRequestStatus" AS ENUM ('CALCULATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompOffCreditStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CompOffAllocationStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- DropIndex
DROP INDEX IF EXISTS "approval_workflows_workflowCode_key";

-- AlterTable: add scopeKey as nullable, backfill, then enforce NOT NULL + unique
ALTER TABLE "approval_workflows" ADD COLUMN "scopeKey" TEXT;

UPDATE "approval_workflows"
SET "scopeKey" = CASE
  WHEN "companyId" IS NULL THEN 'GLOBAL:' || "workflowCode"
  ELSE 'COMPANY:' || "companyId" || ':' || "workflowCode"
END
WHERE "scopeKey" IS NULL;

ALTER TABLE "approval_workflows" ALTER COLUMN "scopeKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "classificationReason" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "scheduleDayType" "ShiftRosterDayType",
ADD COLUMN     "schedulePortion" "DayPortion",
ADD COLUMN     "scheduleTimezone" TEXT,
ADD COLUMN     "scheduledBreakMinutes" INTEGER,
ADD COLUMN     "scheduledEndAt" TIMESTAMP(3),
ADD COLUMN     "scheduledNetMinutes" INTEGER,
ADD COLUMN     "scheduledStartAt" TIMESTAMP(3),
ADD COLUMN     "shiftRosterEntryId" TEXT;

-- AlterTable
ALTER TABLE "branch_working_days" ADD COLUMN     "dayPortion" "DayPortion" NOT NULL DEFAULT 'FULL_DAY',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "dayPortion" "DayPortion" NOT NULL DEFAULT 'FULL_DAY';

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "category" "LeaveTypeCategory" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "shifts" ALTER COLUMN "graceInMinutes" SET DEFAULT 30;

-- CreateTable
CREATE TABLE "shift_rosters" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ShiftRosterStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_roster_entries" (
    "id" TEXT NOT NULL,
    "shiftRosterId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "shiftId" TEXT,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "scheduledNetMinutes" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL,
    "dayType" "ShiftRosterDayType" NOT NULL,
    "dayPortion" "DayPortion" NOT NULL DEFAULT 'FULL_DAY',
    "source" "ShiftRosterEntrySource" NOT NULL DEFAULT 'GENERATED',
    "generationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_roster_overrides" (
    "id" TEXT NOT NULL,
    "shiftRosterEntryId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousSnapshot" JSONB NOT NULL,
    "newSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_roster_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_policies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 30,
    "earlyDepartureGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "fullDayThresholdPercent" INTEGER NOT NULL DEFAULT 90,
    "halfDayThresholdPercent" INTEGER NOT NULL DEFAULT 50,
    "regularizationWindowDays" INTEGER NOT NULL DEFAULT 3,
    "leaveBackdateWindowDays" INTEGER NOT NULL DEFAULT 3,
    "finalizationDelayMinutes" INTEGER NOT NULL DEFAULT 180,
    "maxOpenShiftMinutes" INTEGER NOT NULL DEFAULT 1440,
    "latePenaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automaticLeaveDeductionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exceptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "shiftRosterEntryId" TEXT,
    "businessDate" DATE NOT NULL,
    "type" "AttendanceExceptionType" NOT NULL,
    "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeKey" TEXT NOT NULL,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_regularizations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "attendanceExceptionId" TEXT,
    "proposedCheckInAt" TIMESTAMP(3),
    "proposedCheckOutAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "AttendanceRegularizationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvalTransactionId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_regularizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "AttendancePeriodStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "payrollPendingByUserId" TEXT,
    "payrollPendingAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_transactions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "leaveBalanceId" TEXT NOT NULL,
    "leaveRequestId" TEXT,
    "transactionType" "LeaveBalanceTransactionType" NOT NULL,
    "entitlementDelta" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "usedDelta" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pendingDelta" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "balanceDelta" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "entitlementAfter" DECIMAL(5,2) NOT NULL,
    "usedAfter" DECIMAL(5,2) NOT NULL,
    "pendingAfter" DECIMAL(5,2) NOT NULL,
    "balanceAfter" DECIMAL(5,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_policies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "minimumEligibleMinutes" INTEGER NOT NULL DEFAULT 30,
    "roundingMinutes" INTEGER NOT NULL DEFAULT 15,
    "roundingMode" "OvertimeRoundingMode" NOT NULL DEFAULT 'DOWN',
    "includeEarlyArrival" BOOLEAN NOT NULL DEFAULT false,
    "requireScheduledMinutesFulfilled" BOOLEAN NOT NULL DEFAULT true,
    "allowCompOff" BOOLEAN NOT NULL DEFAULT true,
    "allowPayrollPending" BOOLEAN NOT NULL DEFAULT true,
    "compOffHalfDayMinutes" INTEGER NOT NULL DEFAULT 240,
    "compOffFullDayMinutes" INTEGER NOT NULL DEFAULT 480,
    "maxCompOffDaysPerSource" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "compOffExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "maxDailyMinutes" INTEGER,
    "maxMonthlyMinutes" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "overtimePolicyId" TEXT,
    "businessDate" DATE NOT NULL,
    "rawMinutes" INTEGER NOT NULL,
    "eligibleMinutes" INTEGER NOT NULL,
    "requestedMinutes" INTEGER NOT NULL,
    "approvedMinutes" INTEGER,
    "requestedSettlement" "OvertimeSettlementType" NOT NULL,
    "approvedSettlement" "OvertimeSettlementType",
    "status" "OvertimeRequestStatus" NOT NULL DEFAULT 'CALCULATED',
    "calculationSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "approvalTransactionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comp_off_credits" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "overtimeRequestId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "sourceDate" DATE NOT NULL,
    "earnedDays" DECIMAL(5,2) NOT NULL,
    "availableDays" DECIMAL(5,2) NOT NULL,
    "reservedDays" DECIMAL(5,2) NOT NULL,
    "usedDays" DECIMAL(5,2) NOT NULL,
    "expiresOn" DATE NOT NULL,
    "status" "CompOffCreditStatus" NOT NULL,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comp_off_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comp_off_allocations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "compOffCreditId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "allocatedDays" DECIMAL(5,2) NOT NULL,
    "status" "CompOffAllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comp_off_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyGroupId" TEXT,
    "companyId" TEXT,
    "branchId" TEXT,
    "eventCode" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "companyGroupId" TEXT,
    "companyId" TEXT,
    "branchId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_rosters_companyId_branchId_status_idx" ON "shift_rosters"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "shift_rosters_branchId_periodStart_periodEnd_idx" ON "shift_rosters"("branchId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "shift_rosters_createdByUserId_idx" ON "shift_rosters"("createdByUserId");

-- CreateIndex
CREATE INDEX "shift_rosters_publishedByUserId_idx" ON "shift_rosters"("publishedByUserId");

-- CreateIndex
CREATE INDEX "shift_rosters_lockedByUserId_idx" ON "shift_rosters"("lockedByUserId");

-- CreateIndex
CREATE INDEX "shift_rosters_archivedByUserId_idx" ON "shift_rosters"("archivedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "shift_rosters_branchId_periodStart_periodEnd_version_key" ON "shift_rosters"("branchId", "periodStart", "periodEnd", "version");

-- CreateIndex
CREATE INDEX "shift_roster_entries_employeeId_workDate_idx" ON "shift_roster_entries"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "shift_roster_entries_branchId_workDate_dayType_idx" ON "shift_roster_entries"("branchId", "workDate", "dayType");

-- CreateIndex
CREATE INDEX "shift_roster_entries_shiftRosterId_source_idx" ON "shift_roster_entries"("shiftRosterId", "source");

-- CreateIndex
CREATE INDEX "shift_roster_entries_companyId_idx" ON "shift_roster_entries"("companyId");

-- CreateIndex
CREATE INDEX "shift_roster_entries_shiftId_idx" ON "shift_roster_entries"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "shift_roster_entries_shiftRosterId_employeeId_workDate_key" ON "shift_roster_entries"("shiftRosterId", "employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "shift_roster_entries_shiftRosterId_generationKey_key" ON "shift_roster_entries"("shiftRosterId", "generationKey");

-- CreateIndex
CREATE INDEX "shift_roster_overrides_shiftRosterEntryId_createdAt_idx" ON "shift_roster_overrides"("shiftRosterEntryId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_roster_overrides_changedByUserId_createdAt_idx" ON "shift_roster_overrides"("changedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_roster_overrides_companyId_idx" ON "shift_roster_overrides"("companyId");

-- CreateIndex
CREATE INDEX "shift_roster_overrides_branchId_idx" ON "shift_roster_overrides"("branchId");

-- CreateIndex
CREATE INDEX "shift_roster_overrides_employeeId_idx" ON "shift_roster_overrides"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_policies_companyId_branchId_isActive_idx" ON "attendance_policies"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE INDEX "attendance_policies_companyId_effectiveFrom_idx" ON "attendance_policies"("companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "attendance_policies_branchId_effectiveFrom_idx" ON "attendance_policies"("branchId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "attendance_policies_createdByUserId_idx" ON "attendance_policies"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_exceptions_dedupeKey_key" ON "attendance_exceptions"("dedupeKey");

-- CreateIndex
CREATE INDEX "attendance_exceptions_employeeId_businessDate_status_idx" ON "attendance_exceptions"("employeeId", "businessDate", "status");

-- CreateIndex
CREATE INDEX "attendance_exceptions_branchId_businessDate_type_status_idx" ON "attendance_exceptions"("branchId", "businessDate", "type", "status");

-- CreateIndex
CREATE INDEX "attendance_exceptions_attendanceId_type_idx" ON "attendance_exceptions"("attendanceId", "type");

-- CreateIndex
CREATE INDEX "attendance_exceptions_companyId_idx" ON "attendance_exceptions"("companyId");

-- CreateIndex
CREATE INDEX "attendance_exceptions_shiftRosterEntryId_idx" ON "attendance_exceptions"("shiftRosterEntryId");

-- CreateIndex
CREATE INDEX "attendance_exceptions_resolvedByUserId_idx" ON "attendance_exceptions"("resolvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_regularizations_approvalTransactionId_key" ON "attendance_regularizations"("approvalTransactionId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_companyId_idx" ON "attendance_regularizations"("companyId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_branchId_idx" ON "attendance_regularizations"("branchId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_employeeId_idx" ON "attendance_regularizations"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_attendanceId_idx" ON "attendance_regularizations"("attendanceId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_attendanceExceptionId_idx" ON "attendance_regularizations"("attendanceExceptionId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_status_idx" ON "attendance_regularizations"("status");

-- CreateIndex
CREATE INDEX "attendance_regularizations_requestedByUserId_idx" ON "attendance_regularizations"("requestedByUserId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_reviewedByUserId_idx" ON "attendance_regularizations"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "attendance_periods_companyId_branchId_status_idx" ON "attendance_periods"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "attendance_periods_reviewedByUserId_idx" ON "attendance_periods"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "attendance_periods_lockedByUserId_idx" ON "attendance_periods"("lockedByUserId");

-- CreateIndex
CREATE INDEX "attendance_periods_payrollPendingByUserId_idx" ON "attendance_periods"("payrollPendingByUserId");

-- CreateIndex
CREATE INDEX "attendance_periods_closedByUserId_idx" ON "attendance_periods"("closedByUserId");

-- CreateIndex
CREATE INDEX "attendance_periods_reopenedByUserId_idx" ON "attendance_periods"("reopenedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_periods_branchId_periodYear_periodMonth_key" ON "attendance_periods"("branchId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_transactions_idempotencyKey_key" ON "leave_balance_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_leaveBalanceId_effectiveDate_idx" ON "leave_balance_transactions"("leaveBalanceId", "effectiveDate");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_employeeId_leaveTypeId_effective_idx" ON "leave_balance_transactions"("employeeId", "leaveTypeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_referenceType_referenceId_idx" ON "leave_balance_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_companyId_idx" ON "leave_balance_transactions"("companyId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_branchId_idx" ON "leave_balance_transactions"("branchId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_leaveRequestId_idx" ON "leave_balance_transactions"("leaveRequestId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_createdByUserId_idx" ON "leave_balance_transactions"("createdByUserId");

-- CreateIndex
CREATE INDEX "overtime_policies_companyId_branchId_isActive_idx" ON "overtime_policies"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE INDEX "overtime_policies_companyId_effectiveFrom_idx" ON "overtime_policies"("companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "overtime_policies_branchId_effectiveFrom_idx" ON "overtime_policies"("branchId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "overtime_policies_createdByUserId_idx" ON "overtime_policies"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_requests_approvalTransactionId_key" ON "overtime_requests"("approvalTransactionId");

-- CreateIndex
CREATE INDEX "overtime_requests_employeeId_businessDate_status_idx" ON "overtime_requests"("employeeId", "businessDate", "status");

-- CreateIndex
CREATE INDEX "overtime_requests_branchId_status_businessDate_idx" ON "overtime_requests"("branchId", "status", "businessDate");

-- CreateIndex
CREATE INDEX "overtime_requests_companyId_idx" ON "overtime_requests"("companyId");

-- CreateIndex
CREATE INDEX "overtime_requests_attendanceId_idx" ON "overtime_requests"("attendanceId");

-- CreateIndex
CREATE INDEX "overtime_requests_overtimePolicyId_idx" ON "overtime_requests"("overtimePolicyId");

-- CreateIndex
CREATE INDEX "overtime_requests_approvedByUserId_idx" ON "overtime_requests"("approvedByUserId");

-- CreateIndex
CREATE INDEX "overtime_requests_rejectedByUserId_idx" ON "overtime_requests"("rejectedByUserId");

-- CreateIndex
CREATE INDEX "overtime_requests_cancelledByUserId_idx" ON "overtime_requests"("cancelledByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "comp_off_credits_overtimeRequestId_key" ON "comp_off_credits"("overtimeRequestId");

-- CreateIndex
CREATE INDEX "comp_off_credits_employeeId_status_expiresOn_idx" ON "comp_off_credits"("employeeId", "status", "expiresOn");

-- CreateIndex
CREATE INDEX "comp_off_credits_companyId_idx" ON "comp_off_credits"("companyId");

-- CreateIndex
CREATE INDEX "comp_off_credits_branchId_idx" ON "comp_off_credits"("branchId");

-- CreateIndex
CREATE INDEX "comp_off_credits_leaveTypeId_idx" ON "comp_off_credits"("leaveTypeId");

-- CreateIndex
CREATE INDEX "comp_off_credits_revokedByUserId_idx" ON "comp_off_credits"("revokedByUserId");

-- CreateIndex
CREATE INDEX "comp_off_allocations_leaveRequestId_status_idx" ON "comp_off_allocations"("leaveRequestId", "status");

-- CreateIndex
CREATE INDEX "comp_off_allocations_compOffCreditId_status_idx" ON "comp_off_allocations"("compOffCreditId", "status");

-- CreateIndex
CREATE INDEX "comp_off_allocations_companyId_idx" ON "comp_off_allocations"("companyId");

-- CreateIndex
CREATE INDEX "comp_off_allocations_branchId_idx" ON "comp_off_allocations"("branchId");

-- CreateIndex
CREATE INDEX "comp_off_allocations_employeeId_idx" ON "comp_off_allocations"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "comp_off_allocations_compOffCreditId_leaveRequestId_key" ON "comp_off_allocations"("compOffCreditId", "leaveRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_dedupeKey_key" ON "user_notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "user_notifications_userId_readAt_createdAt_idx" ON "user_notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "user_notifications_companyId_eventCode_createdAt_idx" ON "user_notifications"("companyId", "eventCode", "createdAt");

-- CreateIndex
CREATE INDEX "user_notifications_companyGroupId_idx" ON "user_notifications"("companyGroupId");

-- CreateIndex
CREATE INDEX "user_notifications_branchId_idx" ON "user_notifications"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupeKey_key" ON "outbox_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "outbox_events_status_availableAt_idx" ON "outbox_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_createdAt_idx" ON "outbox_events"("aggregateType", "aggregateId", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_companyGroupId_idx" ON "outbox_events"("companyGroupId");

-- CreateIndex
CREATE INDEX "outbox_events_companyId_idx" ON "outbox_events"("companyId");

-- CreateIndex
CREATE INDEX "outbox_events_branchId_idx" ON "outbox_events"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_scopeKey_key" ON "approval_workflows"("scopeKey");

-- CreateIndex
CREATE INDEX "approval_workflows_workflowCode_idx" ON "approval_workflows"("workflowCode");

-- CreateIndex
CREATE INDEX "approval_workflows_companyId_workflowCode_isActive_idx" ON "approval_workflows"("companyId", "workflowCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_shiftRosterEntryId_key" ON "attendances"("shiftRosterEntryId");

-- CreateIndex
CREATE INDEX "holidays_companyId_branchId_holidayDate_isActive_idx" ON "holidays"("companyId", "branchId", "holidayDate", "isActive");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shiftRosterEntryId_fkey" FOREIGN KEY ("shiftRosterEntryId") REFERENCES "shift_roster_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rosters" ADD CONSTRAINT "shift_rosters_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_entries" ADD CONSTRAINT "shift_roster_entries_shiftRosterId_fkey" FOREIGN KEY ("shiftRosterId") REFERENCES "shift_rosters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_entries" ADD CONSTRAINT "shift_roster_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_entries" ADD CONSTRAINT "shift_roster_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_entries" ADD CONSTRAINT "shift_roster_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_entries" ADD CONSTRAINT "shift_roster_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_overrides" ADD CONSTRAINT "shift_roster_overrides_shiftRosterEntryId_fkey" FOREIGN KEY ("shiftRosterEntryId") REFERENCES "shift_roster_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_overrides" ADD CONSTRAINT "shift_roster_overrides_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_overrides" ADD CONSTRAINT "shift_roster_overrides_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_overrides" ADD CONSTRAINT "shift_roster_overrides_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_roster_overrides" ADD CONSTRAINT "shift_roster_overrides_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_shiftRosterEntryId_fkey" FOREIGN KEY ("shiftRosterEntryId") REFERENCES "shift_roster_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_attendanceExceptionId_fkey" FOREIGN KEY ("attendanceExceptionId") REFERENCES "attendance_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_approvalTransactionId_fkey" FOREIGN KEY ("approvalTransactionId") REFERENCES "approval_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_payrollPendingByUserId_fkey" FOREIGN KEY ("payrollPendingByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_reopenedByUserId_fkey" FOREIGN KEY ("reopenedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leaveBalanceId_fkey" FOREIGN KEY ("leaveBalanceId") REFERENCES "employee_leave_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policies" ADD CONSTRAINT "overtime_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policies" ADD CONSTRAINT "overtime_policies_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policies" ADD CONSTRAINT "overtime_policies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_overtimePolicyId_fkey" FOREIGN KEY ("overtimePolicyId") REFERENCES "overtime_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_approvalTransactionId_fkey" FOREIGN KEY ("approvalTransactionId") REFERENCES "approval_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_overtimeRequestId_fkey" FOREIGN KEY ("overtimeRequestId") REFERENCES "overtime_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_allocations" ADD CONSTRAINT "comp_off_allocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_allocations" ADD CONSTRAINT "comp_off_allocations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_allocations" ADD CONSTRAINT "comp_off_allocations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_allocations" ADD CONSTRAINT "comp_off_allocations_compOffCreditId_fkey" FOREIGN KEY ("compOffCreditId") REFERENCES "comp_off_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_allocations" ADD CONSTRAINT "comp_off_allocations_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- WP-01 extensions: checks, partial unique indexes, ledger trigger, backfill
-- ============================================================================

-- Roster period length <= 62 days
ALTER TABLE "shift_rosters"
  ADD CONSTRAINT "shift_rosters_period_range_check"
  CHECK ("periodStart" <= "periodEnd" AND ("periodEnd" - "periodStart") <= 62);

ALTER TABLE "shift_rosters"
  ADD CONSTRAINT "shift_rosters_version_positive_check"
  CHECK ("version" > 0);

-- Working roster entries require start/end with end > start
ALTER TABLE "shift_roster_entries"
  ADD CONSTRAINT "shift_roster_entries_working_times_check"
  CHECK (
    ("dayType" <> 'WORKING')
    OR (
      "scheduledStartAt" IS NOT NULL
      AND "scheduledEndAt" IS NOT NULL
      AND "scheduledEndAt" > "scheduledStartAt"
      AND "breakMinutes" >= 0
      AND "scheduledNetMinutes" >= 0
    )
  );

-- Attendance policy thresholds
ALTER TABLE "attendance_policies"
  ADD CONSTRAINT "attendance_policies_threshold_check"
  CHECK (
    "fullDayThresholdPercent" BETWEEN 0 AND 100
    AND "halfDayThresholdPercent" BETWEEN 0 AND 100
    AND "halfDayThresholdPercent" < "fullDayThresholdPercent"
    AND "lateGraceMinutes" >= 0
    AND "earlyDepartureGraceMinutes" >= 0
    AND "regularizationWindowDays" >= 0
    AND "leaveBackdateWindowDays" >= 0
    AND "finalizationDelayMinutes" >= 0
    AND "maxOpenShiftMinutes" >= 0
    AND ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
  );

ALTER TABLE "attendance_periods"
  ADD CONSTRAINT "attendance_periods_month_check"
  CHECK ("periodMonth" BETWEEN 1 AND 12 AND "periodStart" <= "periodEnd" AND "version" > 0);

ALTER TABLE "overtime_policies"
  ADD CONSTRAINT "overtime_policies_range_check"
  CHECK (
    "minimumEligibleMinutes" >= 0
    AND "roundingMinutes" > 0
    AND "compOffHalfDayMinutes" > 0
    AND "compOffFullDayMinutes" > 0
    AND "compOffExpiryDays" > 0
    AND "maxCompOffDaysPerSource" > 0
    AND ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
  );

ALTER TABLE "overtime_requests"
  ADD CONSTRAINT "overtime_requests_minutes_check"
  CHECK (
    "rawMinutes" >= 0
    AND "eligibleMinutes" >= 0
    AND "requestedMinutes" >= 0
    AND ("approvedMinutes" IS NULL OR ("approvedMinutes" >= 0 AND "approvedMinutes" <= "eligibleMinutes"))
  );

ALTER TABLE "comp_off_credits"
  ADD CONSTRAINT "comp_off_credits_balance_equation_check"
  CHECK (
    "availableDays" >= 0
    AND "reservedDays" >= 0
    AND "usedDays" >= 0
    AND "earnedDays" > 0
    AND "earnedDays" <= 1
    AND ("availableDays" + "reservedDays" + "usedDays") <= "earnedDays"
  );

ALTER TABLE "comp_off_allocations"
  ADD CONSTRAINT "comp_off_allocations_positive_check"
  CHECK ("allocatedDays" > 0);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ux_leave_types_one_active_comp_off_per_company"
  ON "leave_types" ("companyId")
  WHERE "category" = 'COMP_OFF' AND "isActive" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_attendance_policies_company_effective_from"
  ON "attendance_policies" ("companyId", "effectiveFrom")
  WHERE "branchId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_attendance_policies_branch_effective_from"
  ON "attendance_policies" ("branchId", "effectiveFrom")
  WHERE "branchId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_overtime_policies_company_effective_from"
  ON "overtime_policies" ("companyId", "effectiveFrom")
  WHERE "branchId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_overtime_policies_branch_effective_from"
  ON "overtime_policies" ("branchId", "effectiveFrom")
  WHERE "branchId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_attendance_regularizations_one_submitted_per_attendance"
  ON "attendance_regularizations" ("attendanceId")
  WHERE "status" = 'SUBMITTED';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_overtime_requests_one_active_per_attendance"
  ON "overtime_requests" ("attendanceId")
  WHERE "status" IN ('CALCULATED', 'SUBMITTED', 'APPROVED', 'SETTLED');

-- Immutable leave ledger trigger
CREATE OR REPLACE FUNCTION "leave_balance_transactions_immutable"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'leave_balance_transactions are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_leave_balance_transactions_no_update" ON "leave_balance_transactions";
CREATE TRIGGER "trg_leave_balance_transactions_no_update"
  BEFORE UPDATE OR DELETE ON "leave_balance_transactions"
  FOR EACH ROW EXECUTE FUNCTION "leave_balance_transactions_immutable"();

-- Backfill: existing COMP_OFF leave codes -> category COMP_OFF
UPDATE "leave_types"
SET "category" = 'COMP_OFF'
WHERE upper("leaveCode") = 'COMP_OFF' AND "category" <> 'COMP_OFF';

-- Reactivate the newest inactive COMP_OFF type when a company has none active
UPDATE "leave_types" lt
SET "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("companyId") "id", "companyId"
  FROM "leave_types"
  WHERE "category" = 'COMP_OFF' AND "isActive" = false
  ORDER BY "companyId", "updatedAt" DESC
) pick
WHERE lt."id" = pick."id"
  AND NOT EXISTS (
    SELECT 1 FROM "leave_types" active
    WHERE active."companyId" = pick."companyId"
      AND active."category" = 'COMP_OFF'
      AND active."isActive" = true
  );

-- Backfill: ensure every company has one active COMP_OFF leave type
INSERT INTO "leave_types" (
  "id", "companyId", "leaveCode", "leaveName", "description",
  "isPaid", "requiresApproval", "allowHalfDay", "isActive", "carryForwardAllowed",
  "category", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  'COMP_OFF',
  'Comp-off',
  'Compensatory off credit from approved overtime',
  true,
  true,
  true,
  true,
  false,
  'COMP_OFF',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "leave_types" lt
  WHERE lt."companyId" = c."id"
    AND lt."category" = 'COMP_OFF'
    AND lt."isActive" = true
)
AND NOT EXISTS (
  SELECT 1 FROM "leave_types" lt
  WHERE lt."companyId" = c."id"
    AND upper(lt."leaveCode") = 'COMP_OFF'
);

-- Backfill: global approval workflows required by workforce module
INSERT INTO "approval_workflows" (
  "id", "workflowCode", "workflowName", "scopeKey", "companyId", "isActive", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, v.code, v.name, 'GLOBAL:' || v.code, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('LEAVE_APPROVAL', 'Leave Approval'),
  ('ATTENDANCE_REGULARIZATION', 'Attendance Regularization'),
  ('OVERTIME_APPROVAL', 'Overtime Approval')
) AS v(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM "approval_workflows" aw
  WHERE aw."scopeKey" = 'GLOBAL:' || v.code
);

-- Opening snapshots for existing active leave balances
INSERT INTO "leave_balance_transactions" (
  "id", "companyId", "branchId", "employeeId", "leaveTypeId", "leaveBalanceId", "leaveRequestId",
  "transactionType",
  "entitlementDelta", "usedDelta", "pendingDelta", "balanceDelta",
  "entitlementAfter", "usedAfter", "pendingAfter", "balanceAfter",
  "effectiveDate", "referenceType", "referenceId", "idempotencyKey", "reason", "createdByUserId", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  e."companyId",
  e."branchId",
  b."employeeId",
  b."leaveTypeId",
  b."id",
  NULL,
  'OPENING_SNAPSHOT',
  b."entitlement",
  b."used",
  b."pending",
  b."balance",
  b."entitlement",
  b."used",
  b."pending",
  b."balance",
  CURRENT_DATE,
  'MIGRATION_BASELINE',
  b."id",
  'OPENING:' || b."id" || ':V1',
  'WP-01 migration opening snapshot',
  NULL,
  CURRENT_TIMESTAMP
FROM "employee_leave_balances" b
JOIN "employees" e ON e."id" = b."employeeId"
WHERE b."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "leave_balance_transactions" t
    WHERE t."idempotencyKey" = 'OPENING:' || b."id" || ':V1'
  );
