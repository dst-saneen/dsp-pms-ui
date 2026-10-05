/**
 * Canonical attendance domain values (D3-01).
 */

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
