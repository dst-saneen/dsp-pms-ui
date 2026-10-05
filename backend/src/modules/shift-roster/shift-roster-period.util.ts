import { BadRequestException } from '@nestjs/common';

import { WorkforcePolicyDefaults } from '../../common/constants/workforce-time-contracts';
import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { enumerateCalendarDates } from '../leave-policy/leave-calendar.util';

export const ROSTER_MAX_PERIOD_DAYS =
  WorkforcePolicyDefaults.rosterMaxPeriodDays;

export function parseCalendarDateInput(value: string | Date): string {
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) {
      return match[1];
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid calendar date');
  }

  return date.toISOString().slice(0, 10);
}

export function inclusivePeriodDayCount(
  periodStart: string,
  periodEnd: string,
): number {
  return enumerateCalendarDates(periodStart, periodEnd).length;
}

export function assertRosterPeriodRange(
  periodStart: string,
  periodEnd: string,
) {
  if (periodStart > periodEnd) {
    throw new BadRequestException('periodStart cannot be after periodEnd');
  }

  const days = inclusivePeriodDayCount(periodStart, periodEnd);
  if (days > ROSTER_MAX_PERIOD_DAYS) {
    throw new BadRequestException({
      code: WorkforceTimeErrorCode.ROSTER_PERIOD_TOO_LONG,
      message: `Roster period cannot exceed ${ROSTER_MAX_PERIOD_DAYS} days`,
    });
  }
}

export function calendarRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function calendarDateToDbDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}
