import { JobApplicationStatus, JobOpeningStatus } from '@prisma/client';

export const EMPLOYMENT_STATUS = {
  PENDING_ONBOARDING: 'PENDING_ONBOARDING',
  PROBATION: 'PROBATION',
  ACTIVE: 'ACTIVE',
} as const;

export type EmploymentStatusValue =
  (typeof EMPLOYMENT_STATUS)[keyof typeof EMPLOYMENT_STATUS];

export interface WeightedScoreInput {
  score: number;
  weightPercent: number;
}

const MAX_CRITERION_SCORE = 5;

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function normalizeMobile(value: string): string {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return hasLeadingPlus ? `+${digits}` : digits;
}

/**
 * Server-authoritative weighted total for interview evaluations.
 * Criteria weights total 100%; each score is 1–5 mapped proportionally.
 */
export function calculateWeightedTotal(scores: WeightedScoreInput[]): number {
  if (scores.length === 0) {
    return 0;
  }

  const total = scores.reduce((sum, entry) => {
    const weight = Number(entry.weightPercent);
    const score = Number(entry.score);

    if (
      !Number.isFinite(weight) ||
      !Number.isFinite(score) ||
      score < 1 ||
      score > MAX_CRITERION_SCORE
    ) {
      return sum;
    }

    const contribution = (score / MAX_CRITERION_SCORE) * weight;
    return sum + contribution;
  }, 0);

  return Math.round(total * 100) / 100;
}

const TERMINAL_APPLICATION_STATUSES = new Set<JobApplicationStatus>([
  JobApplicationStatus.HIRED,
  JobApplicationStatus.REJECTED,
  JobApplicationStatus.WITHDRAWN,
  JobApplicationStatus.OFFER_DECLINED,
]);

const TERMINAL_OPENING_STATUSES = new Set<JobOpeningStatus>([
  JobOpeningStatus.FILLED,
  JobOpeningStatus.CLOSED,
]);

export const allowedApplicationTransitions: Readonly<
  Record<JobApplicationStatus, readonly JobApplicationStatus[]>
> = {
  [JobApplicationStatus.APPLIED]: [
    JobApplicationStatus.SHORTLISTED,
    JobApplicationStatus.SCREENING,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.SHORTLISTED]: [
    JobApplicationStatus.SCREENING,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.SCREENING]: [
    JobApplicationStatus.INTERVIEW,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.INTERVIEW]: [
    JobApplicationStatus.MANAGER_REVIEW,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.MANAGER_REVIEW]: [
    JobApplicationStatus.SELECTED,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.SELECTED]: [
    JobApplicationStatus.OFFER_SENT,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.OFFER_SENT]: [
    JobApplicationStatus.OFFER_ACCEPTED,
    JobApplicationStatus.OFFER_DECLINED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.OFFER_ACCEPTED]: [JobApplicationStatus.HIRED],
  [JobApplicationStatus.HIRED]: [],
  [JobApplicationStatus.REJECTED]: [],
  [JobApplicationStatus.WITHDRAWN]: [],
  [JobApplicationStatus.OFFER_DECLINED]: [],
};

export const allowedOpeningTransitions: Readonly<
  Record<JobOpeningStatus, readonly JobOpeningStatus[]>
> = {
  [JobOpeningStatus.DRAFT]: [JobOpeningStatus.OPEN],
  [JobOpeningStatus.OPEN]: [
    JobOpeningStatus.ON_HOLD,
    JobOpeningStatus.FILLED,
    JobOpeningStatus.CLOSED,
  ],
  [JobOpeningStatus.ON_HOLD]: [
    JobOpeningStatus.OPEN,
    JobOpeningStatus.FILLED,
    JobOpeningStatus.CLOSED,
  ],
  [JobOpeningStatus.FILLED]: [JobOpeningStatus.CLOSED],
  [JobOpeningStatus.CLOSED]: [],
};

export const allowedEmployeeLifecycleTransitions: Readonly<
  Record<EmploymentStatusValue, readonly EmploymentStatusValue[]>
> = {
  [EMPLOYMENT_STATUS.PENDING_ONBOARDING]: [EMPLOYMENT_STATUS.PROBATION],
  [EMPLOYMENT_STATUS.PROBATION]: [EMPLOYMENT_STATUS.ACTIVE],
  [EMPLOYMENT_STATUS.ACTIVE]: [],
};

export function isAllowedApplicationTransition(
  from: JobApplicationStatus,
  to: JobApplicationStatus,
  shortlistEnabled = false,
): boolean {
  if (
    from === JobApplicationStatus.APPLIED &&
    to === JobApplicationStatus.SCREENING
  ) {
    return !shortlistEnabled;
  }

  if (
    from === JobApplicationStatus.APPLIED &&
    to === JobApplicationStatus.SHORTLISTED
  ) {
    return shortlistEnabled;
  }

  return allowedApplicationTransitions[from]?.includes(to) ?? false;
}

export function isAllowedOpeningTransition(
  from: JobOpeningStatus,
  to: JobOpeningStatus,
): boolean {
  return allowedOpeningTransitions[from]?.includes(to) ?? false;
}

export function isAllowedEmployeeLifecycleTransition(
  from: EmploymentStatusValue,
  to: EmploymentStatusValue,
): boolean {
  return allowedEmployeeLifecycleTransitions[from]?.includes(to) ?? false;
}

export function getAllowedApplicationActions(
  status: JobApplicationStatus,
): JobApplicationStatus[] {
  if (TERMINAL_APPLICATION_STATUSES.has(status)) {
    return [];
  }

  return [...(allowedApplicationTransitions[status] ?? [])];
}

export function getAllowedOpeningActions(
  status: JobOpeningStatus,
): JobOpeningStatus[] {
  if (TERMINAL_OPENING_STATUSES.has(status)) {
    return [];
  }

  return [...(allowedOpeningTransitions[status] ?? [])];
}

export function getAllowedEmployeeLifecycleActions(
  status: string,
): EmploymentStatusValue[] {
  if (!(status in allowedEmployeeLifecycleTransitions)) {
    return [];
  }

  return [
    ...(allowedEmployeeLifecycleTransitions[status as EmploymentStatusValue] ??
      []),
  ];
}
