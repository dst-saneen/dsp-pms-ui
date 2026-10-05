import { BusinessDayEffect, DayPortion } from '@prisma/client';

import {
  resolveBusinessDay,
  type ResolvedBusinessDay,
  type RuntimeEvent,
  type RuntimeWeekRule,
} from './business-calendar-runtime.util';

export function mapHolidayPortionToBusinessDayEffect(
  dayPortion: string,
): BusinessDayEffect {
  switch (dayPortion) {
    case DayPortion.FIRST_HALF:
    case 'FIRST_HALF':
      return BusinessDayEffect.FIRST_HALF_NON_WORKING;
    case DayPortion.SECOND_HALF:
    case 'SECOND_HALF':
      return BusinessDayEffect.SECOND_HALF_NON_WORKING;
    case DayPortion.FULL_DAY:
    case 'FULL_DAY':
    default:
      return BusinessDayEffect.NON_WORKING_DAY;
  }
}

export type LegacyDayInput = {
  businessDate: Date;
  companyId: string;
  branchId: string | null;
  workingDays: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    dayPortion: string;
  }>;
  holidays: Array<{
    id: string;
    holidayName: string;
    holidayDate: Date;
    dayPortion: string;
    branchId: string | null;
  }>;
};

export type LegacyDayResult = {
  dayStatus: 'WORKING' | 'NON_WORKING';
  dayPortion: string;
  reasonCode: string;
  reasonText: string;
  holidayId: string | null;
};

/**
 * Legacy BranchWorkingDay + Holiday resolution used by Leave/Roster today.
 * Leave treats any holiday as full exclude; roster respects dayPortion.
 * Shadow compare uses roster-aligned portion handling.
 */
export function resolveLegacyBusinessDay(
  input: LegacyDayInput,
): LegacyDayResult {
  const dayOfWeek = input.businessDate.getUTCDay();
  const dateKey = input.businessDate.toISOString().slice(0, 10);

  const holiday = input.holidays.find((row) => {
    if (row.holidayDate.toISOString().slice(0, 10) !== dateKey) return false;
    if (row.branchId == null) return true;
    return !!input.branchId && row.branchId === input.branchId;
  });

  if (holiday) {
    if (
      holiday.dayPortion === DayPortion.FIRST_HALF ||
      holiday.dayPortion === 'FIRST_HALF'
    ) {
      return {
        dayStatus: 'WORKING',
        dayPortion: DayPortion.FIRST_HALF,
        reasonCode: 'LEGACY_HOLIDAY',
        reasonText: holiday.holidayName,
        holidayId: holiday.id,
      };
    }
    if (
      holiday.dayPortion === DayPortion.SECOND_HALF ||
      holiday.dayPortion === 'SECOND_HALF'
    ) {
      return {
        dayStatus: 'WORKING',
        dayPortion: DayPortion.SECOND_HALF,
        reasonCode: 'LEGACY_HOLIDAY',
        reasonText: holiday.holidayName,
        holidayId: holiday.id,
      };
    }
    return {
      dayStatus: 'NON_WORKING',
      dayPortion: DayPortion.FULL_DAY,
      reasonCode: 'LEGACY_HOLIDAY',
      reasonText: holiday.holidayName,
      holidayId: holiday.id,
    };
  }

  const week = input.workingDays.find((row) => row.dayOfWeek === dayOfWeek);
  if (!week) {
    return {
      dayStatus: 'NON_WORKING',
      dayPortion: DayPortion.FULL_DAY,
      reasonCode: 'LEGACY_WEEK_MISSING',
      reasonText: `No BranchWorkingDay for day ${dayOfWeek}`,
      holidayId: null,
    };
  }

  return {
    dayStatus: week.isWorkingDay ? 'WORKING' : 'NON_WORKING',
    dayPortion: week.dayPortion,
    reasonCode: 'LEGACY_WORKING_WEEK',
    reasonText: `BranchWorkingDay day ${dayOfWeek}`,
    holidayId: null,
  };
}

export type ParityDifferenceCategory =
  | 'MISSING_TIMEZONE'
  | 'MISSING_COMPANY_WORKING_WEEK'
  | 'HOLIDAY_PRECEDENCE'
  | 'HALF_DAY_HANDLING'
  | 'INVALID_LEGACY_DATE'
  | 'LEGITIMATE_BRANCH_OVERRIDE'
  | 'STATUS_MISMATCH'
  | 'UNEXPLAINED';

export function categorizeParityDifference(input: {
  legacy: LegacyDayResult;
  next: ResolvedBusinessDay;
  hasCompanyWorkingWeek: boolean;
  timezoneValid: boolean;
  branchHasOverride: boolean;
}): ParityDifferenceCategory {
  if (!input.timezoneValid) return 'MISSING_TIMEZONE';
  if (!input.hasCompanyWorkingWeek) return 'MISSING_COMPANY_WORKING_WEEK';
  if (
    input.legacy.reasonCode === 'LEGACY_HOLIDAY' &&
    input.next.reasonCode === 'EVENT' &&
    (input.legacy.dayPortion !== input.next.dayPortion ||
      input.legacy.dayStatus !== input.next.dayStatus)
  ) {
    return 'HALF_DAY_HANDLING';
  }
  if (input.legacy.reasonCode === 'LEGACY_WEEK_MISSING') {
    return 'INVALID_LEGACY_DATE';
  }
  if (input.branchHasOverride && input.next.reasonCode === 'BRANCH_WEEK') {
    return 'LEGITIMATE_BRANCH_OVERRIDE';
  }
  if (input.legacy.dayStatus !== input.next.dayStatus) {
    return 'STATUS_MISMATCH';
  }
  return 'UNEXPLAINED';
}

export function buildNewModelDay(input: {
  companyId: string;
  branchId: string | null;
  businessDate: Date;
  companyWeekRules: RuntimeWeekRule[];
  companyEvents: RuntimeEvent[];
  branchWeekRules?: RuntimeWeekRule[];
  branchEvents?: RuntimeEvent[];
  sourceChecksum: string;
}): ResolvedBusinessDay {
  return resolveBusinessDay(input);
}
