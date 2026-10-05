import type { WorkLogStatus } from '@prisma/client';

const WORK_LOG_TRANSITIONS: Record<WorkLogStatus, WorkLogStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'RETURNED'],
  RETURNED: ['SUBMITTED', 'CANCELLED'],
  APPROVED: [],
  CANCELLED: [],
};

export function canTransitionWorkLog(
  from: WorkLogStatus,
  to: WorkLogStatus,
): boolean {
  return WORK_LOG_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isEditableWorkLogStatus(status: WorkLogStatus): boolean {
  return status === 'DRAFT' || status === 'RETURNED';
}
