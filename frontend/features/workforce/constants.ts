/**
 * Canonical leave / attendance domain values (D3-01).
 * Keep aligned with backend employee-leave and attendance constants.
 */

export const LEAVE_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const LeaveRequestStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<LeaveRequestStatus, LeaveRequestStatus>;

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'LEAVE',
  'HOLIDAY',
  'WEEK_OFF',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  HALF_DAY: 'HALF_DAY',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEK_OFF: 'WEEK_OFF',
} as const satisfies Record<AttendanceStatus, AttendanceStatus>;

export const ATTENDANCE_SOURCES = [
  'MANUAL',
  'SELF_SERVICE',
  'IMPORT',
  'API',
] as const;

export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

export const AttendanceSource = {
  MANUAL: 'MANUAL',
  SELF_SERVICE: 'SELF_SERVICE',
  IMPORT: 'IMPORT',
  API: 'API',
} as const satisfies Record<AttendanceSource, AttendanceSource>;

export const ATTENDANCE_APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;

export type AttendanceApprovalStatus =
  (typeof ATTENDANCE_APPROVAL_STATUSES)[number];

export const AttendanceApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const satisfies Record<AttendanceApprovalStatus, AttendanceApprovalStatus>;

export const WorkforceErrorCode = {
  EMPLOYEE_LINK_REQUIRED: 'EMPLOYEE_LINK_REQUIRED',
  LEAVE_POLICY_NOT_FOUND: 'LEAVE_POLICY_NOT_FOUND',
  LEAVE_BALANCE_NOT_FOUND: 'LEAVE_BALANCE_NOT_FOUND',
  LEAVE_BALANCE_INSUFFICIENT: 'LEAVE_BALANCE_INSUFFICIENT',
  LEAVE_OVERLAP: 'LEAVE_OVERLAP',
  LEAVE_STATE_CHANGED: 'LEAVE_STATE_CHANGED',
  LEAVE_SELF_APPROVAL_FORBIDDEN: 'LEAVE_SELF_APPROVAL_FORBIDDEN',
  BRANCH_TIMEZONE_REQUIRED: 'BRANCH_TIMEZONE_REQUIRED',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',
  ALREADY_CHECKED_OUT: 'ALREADY_CHECKED_OUT',
  ATTENDANCE_STATE_CHANGED: 'ATTENDANCE_STATE_CHANGED',
} as const;

export type WorkforceErrorCode =
  (typeof WorkforceErrorCode)[keyof typeof WorkforceErrorCode];
