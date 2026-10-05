import {
  LeaveRequestStatus,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
} from '../employee-leave/constants';

export const LEAVE_OVERLAP_STATUSES = [
  LeaveRequestStatus.SUBMITTED,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
  LeaveRequestStatus.APPROVED,
] as const;

export function isSubmittedLeaveStatus(status: string): boolean {
  return (
    status === LeaveRequestStatus.SUBMITTED ||
    status === LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS
  );
}

export const SERIALIZABLE_RETRY_LIMIT = 3;

export function isSerializationFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  if (candidate.code === 'P2034') {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? '';
  return (
    message.includes('could not serialize') ||
    message.includes('serialization') ||
    message.includes('deadlock')
  );
}
