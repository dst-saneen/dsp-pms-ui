/**
 * WP-00 frozen workforce time-management enums / workflow codes / defaults.
 * Source: workforce-time-management-plan.md + development work order.
 *
 * Application services should import from here instead of scattering string literals.
 * Prisma enums will be added in WP-01; keep these values identical to the DB contract.
 */

export const DayPortion = {
  FULL_DAY: 'FULL_DAY',
  FIRST_HALF: 'FIRST_HALF',
  SECOND_HALF: 'SECOND_HALF',
} as const;

export const LeaveTypeCategory = {
  STANDARD: 'STANDARD',
  UNPAID: 'UNPAID',
  COMP_OFF: 'COMP_OFF',
  OPTIONAL_HOLIDAY: 'OPTIONAL_HOLIDAY',
} as const;

export const ShiftRosterStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  LOCKED: 'LOCKED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ShiftRosterDayType = {
  WORKING: 'WORKING',
  WEEK_OFF: 'WEEK_OFF',
  HOLIDAY: 'HOLIDAY',
  SCHEDULED_HALF_DAY: 'SCHEDULED_HALF_DAY',
} as const;

export const ShiftRosterEntrySource = {
  GENERATED: 'GENERATED',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
} as const;

export const AttendanceExceptionType = {
  LATE: 'LATE',
  EARLY_DEPARTURE: 'EARLY_DEPARTURE',
  MISSING_CHECK_IN: 'MISSING_CHECK_IN',
  MISSING_CHECK_OUT: 'MISSING_CHECK_OUT',
  INSUFFICIENT_HOURS: 'INSUFFICIENT_HOURS',
  UNSCHEDULED_WORK: 'UNSCHEDULED_WORK',
  SHIFT_MISMATCH: 'SHIFT_MISMATCH',
} as const;

export const AttendanceExceptionStatus = {
  OPEN: 'OPEN',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESOLVED: 'RESOLVED',
} as const;

export const AttendanceRegularizationStatus = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const AttendancePeriodStatus = {
  OPEN: 'OPEN',
  REVIEW: 'REVIEW',
  LOCKED: 'LOCKED',
  PAYROLL_PENDING: 'PAYROLL_PENDING',
  CLOSED: 'CLOSED',
} as const;

export const LeaveBalanceTransactionType = {
  OPENING_SNAPSHOT: 'OPENING_SNAPSHOT',
  ENTITLEMENT: 'ENTITLEMENT',
  ACCRUAL: 'ACCRUAL',
  CARRY_FORWARD: 'CARRY_FORWARD',
  RESERVATION: 'RESERVATION',
  CONSUMPTION: 'CONSUMPTION',
  REVERSAL: 'REVERSAL',
  ADJUSTMENT: 'ADJUSTMENT',
  EXPIRY: 'EXPIRY',
} as const;

export const OvertimeSettlementType = {
  COMP_OFF: 'COMP_OFF',
  PAYROLL_PENDING: 'PAYROLL_PENDING',
} as const;

export const OvertimeRequestStatus = {
  CALCULATED: 'CALCULATED',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
} as const;

export const CompOffCreditStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;

export const CompOffAllocationStatus = {
  RESERVED: 'RESERVED',
  CONSUMED: 'CONSUMED',
  RELEASED: 'RELEASED',
} as const;

export const OutboxEventStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  FAILED: 'FAILED',
  PROCESSED: 'PROCESSED',
} as const;

/** Required approval workflow codes (WP-02). */
export const WorkforceWorkflowCode = {
  LEAVE_APPROVAL: 'LEAVE_APPROVAL',
  ATTENDANCE_REGULARIZATION: 'ATTENDANCE_REGULARIZATION',
  OVERTIME_APPROVAL: 'OVERTIME_APPROVAL',
  HR_REQUEST: 'HR_REQUEST',
  EMPLOYEE_SEPARATION: 'EMPLOYEE_SEPARATION',
} as const;

/** New permission catalog entries (WP-02). */
export const WorkforcePermission = {
  SCHEDULE_READ: 'hr.schedule.read',
  SCHEDULE_MANAGE: 'hr.schedule.manage',
  SCHEDULE_PUBLISH: 'hr.schedule.publish',
  HOLIDAYS_READ: 'hr.holidays.read',
  HOLIDAYS_MANAGE: 'hr.holidays.manage',
  BUSINESS_CALENDAR_READ: 'calendar.business.read',
  BUSINESS_CALENDAR_MANAGE: 'calendar.business.manage',
  BUSINESS_CALENDAR_REVIEW: 'calendar.business.review',
  BUSINESS_CALENDAR_PUBLISH: 'calendar.business.publish',
  BUSINESS_CALENDAR_AMEND: 'calendar.business.amend',
  BUSINESS_CALENDAR_IMPORT: 'calendar.business.import',
  BUSINESS_CALENDAR_RUNTIME_PREVIEW: 'calendar.business.runtime.preview',
  BUSINESS_CALENDAR_PROTECTED_OVERRIDE: 'calendar.business.protected-override',
  ATTENDANCE_REGULARIZE: 'hr.attendance.regularize',
  ATTENDANCE_LOCK: 'hr.attendance.lock',
  OVERTIME_READ: 'hr.overtime.read',
  OVERTIME_MANAGE: 'hr.overtime.manage',
  OVERTIME_APPROVE: 'hr.overtime.approve',
  COMP_OFF_READ: 'hr.comp-off.read',
  COMP_OFF_MANAGE: 'hr.comp-off.manage',
  CALENDAR_READ: 'hr.calendar.read',
  TEAM_READ: 'hr.team.read',
  TEAM_APPROVE: 'hr.team.approve',
} as const;

/** Locked defaults from plan decision register. */
export const WorkforcePolicyDefaults = {
  lateGraceMinutes: 30,
  earlyDepartureGraceMinutes: 15,
  fullDayThresholdPercent: 90,
  halfDayThresholdPercent: 50,
  regularizationWindowDays: 3,
  leaveBackdateWindowDays: 3,
  finalizationDelayMinutes: 180,
  maxOpenShiftMinutes: 1440,
  overtimeMinimumEligibleMinutes: 30,
  overtimeRoundingMinutes: 15,
  compOffHalfDayMinutes: 240,
  compOffFullDayMinutes: 480,
  maxCompOffDaysPerSource: 1,
  compOffExpiryDays: 90,
  rosterMaxPeriodDays: 62,
  newShiftGraceInMinutesDefault: 30,
} as const;

/** Job env keys (WP-07). Default jobs disabled. */
export const WorkforceJobEnv = {
  WORKFORCE_JOBS_ENABLED: 'WORKFORCE_JOBS_ENABLED',
  WORKFORCE_JOB_BATCH_SIZE: 'WORKFORCE_JOB_BATCH_SIZE',
  ATTENDANCE_FINALIZER_INTERVAL_MINUTES:
    'ATTENDANCE_FINALIZER_INTERVAL_MINUTES',
} as const;
