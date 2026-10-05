/**
 * Canonical leave-request statuses (D3-01).
 * Legacy rows may still store PENDING after submit; normalize to SUBMITTED in D3-02.
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

/** Statuses that block overlapping new leave for the same employee. */
export const LEAVE_OVERLAP_BLOCKING_STATUSES = [
  LeaveRequestStatus.SUBMITTED,
  LeaveRequestStatus.APPROVED,
] as const satisfies readonly LeaveRequestStatus[];

/** Legacy submit status still present in DB/services before D3-02 normalization. */
export const LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS = 'PENDING' as const;
