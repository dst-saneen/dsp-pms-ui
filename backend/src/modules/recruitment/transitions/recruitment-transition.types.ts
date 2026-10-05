import {
  JobApplication,
  JobApplicationStatus,
  JobOpening,
  JobOpeningStatus,
} from '@prisma/client';

export type JobOpeningAction =
  'update' | 'publish' | 'hold' | 'reopen' | 'close';

export type JobApplicationAction =
  | 'shortlist'
  | 'start-screening'
  | 'advance-to-interview'
  | 'advance-to-manager-review'
  | 'reject'
  | 'withdraw'
  | 'select'
  | 'send-offer'
  | 'convert';

export interface RecruitmentTransitionResult<T> {
  record: T;
  version: number;
  allowedActions: string[];
}

export function getJobOpeningAllowedActions(
  status: JobOpeningStatus,
): JobOpeningAction[] {
  switch (status) {
    case 'DRAFT':
      return ['update', 'publish'];
    case 'OPEN':
      return ['hold', 'close'];
    case 'ON_HOLD':
      return ['reopen', 'close'];
    case 'FILLED':
      return ['close'];
    case 'CLOSED':
    default:
      return [];
  }
}

export function getJobApplicationAllowedActions(
  status: JobApplicationStatus,
  shortlistEnabled = false,
): JobApplicationAction[] {
  switch (status) {
    case 'APPLIED':
      return shortlistEnabled
        ? ['shortlist', 'reject', 'withdraw']
        : ['start-screening', 'reject', 'withdraw'];
    case 'SHORTLISTED':
      return ['start-screening', 'reject', 'withdraw'];
    case 'SCREENING':
      return ['advance-to-interview', 'reject', 'withdraw'];
    case 'INTERVIEW':
      return ['advance-to-manager-review', 'reject', 'withdraw'];
    case 'MANAGER_REVIEW':
      return ['select', 'reject'];
    case 'SELECTED':
      return ['send-offer', 'reject'];
    case 'OFFER_SENT':
      return ['reject'];
    case 'OFFER_ACCEPTED':
      return ['convert'];
    case 'HIRED':
    case 'REJECTED':
    case 'WITHDRAWN':
    case 'OFFER_DECLINED':
    default:
      return [];
  }
}

export type JobOpeningTransitionResult =
  RecruitmentTransitionResult<JobOpening>;

export type JobApplicationTransitionResult =
  RecruitmentTransitionResult<JobApplication>;
