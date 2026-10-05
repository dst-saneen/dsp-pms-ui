import type {
  OnboardingTaskDueState,
  OnboardingTaskOwnerType,
  OnboardingTaskWorkType,
} from '../contracts/onboarding-runtime.contracts';

export function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null,
): string {
  const combined = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return combined || fallback || 'Unknown';
}

export function toIsoDate(
  value: Date | string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function addCalendarDays(startDate: Date, days: number): Date {
  const dueDate = new Date(startDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + days);
  return dueDate;
}

export function calculateDueState(
  dueDate: Date | string | null | undefined,
  status: string,
  asOf: Date = new Date(),
): OnboardingTaskDueState {
  if (!dueDate || (status !== 'PENDING' && status !== 'IN_PROGRESS')) {
    return 'NONE';
  }

  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return 'NONE';
  }

  if (due.getTime() < asOf.getTime()) {
    return 'OVERDUE';
  }

  const soon = new Date(asOf);
  soon.setUTCDate(soon.getUTCDate() + 2);

  if (due.getTime() <= soon.getTime()) {
    return 'DUE_SOON';
  }

  return 'UPCOMING';
}

export function isSupportedOwnerType(
  ownerType: string | null | undefined,
): ownerType is OnboardingTaskOwnerType {
  return (
    ownerType === 'DEPARTMENT' ||
    ownerType === 'EMPLOYEE' ||
    ownerType === 'MANAGER'
  );
}

export function isSupportedWorkType(
  workType: string | null | undefined,
): workType is OnboardingTaskWorkType {
  return workType === 'CHECKLIST' || workType === 'ASSET';
}

export function taskStatusFromLegacy(status: string): string {
  return status;
}
