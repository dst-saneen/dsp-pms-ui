import { DayPortion } from '@prisma/client';

import {
  categorizeParityDifference,
  mapHolidayPortionToBusinessDayEffect,
  resolveLegacyBusinessDay,
} from './business-calendar-migration.util';
import { buildShadowCompareRange } from './business-calendar-shadow.runner';
import { BusinessDayEffect, BusinessDayStatus } from '@prisma/client';

describe('business-calendar-migration.util', () => {
  it('maps holiday portions to business-day effects', () => {
    expect(mapHolidayPortionToBusinessDayEffect(DayPortion.FULL_DAY)).toBe(
      BusinessDayEffect.NON_WORKING_DAY,
    );
    expect(mapHolidayPortionToBusinessDayEffect(DayPortion.FIRST_HALF)).toBe(
      BusinessDayEffect.FIRST_HALF_NON_WORKING,
    );
    expect(mapHolidayPortionToBusinessDayEffect(DayPortion.SECOND_HALF)).toBe(
      BusinessDayEffect.SECOND_HALF_NON_WORKING,
    );
  });

  it('resolves legacy full-day holiday as non-working', () => {
    const date = new Date('2026-08-07T00:00:00.000Z');
    const result = resolveLegacyBusinessDay({
      businessDate: date,
      companyId: 'co-1',
      branchId: 'br-1',
      workingDays: [
        {
          dayOfWeek: 5,
          isWorkingDay: true,
          dayPortion: DayPortion.FULL_DAY,
        },
      ],
      holidays: [
        {
          id: 'h1',
          holidayName: 'Onam',
          holidayDate: date,
          dayPortion: DayPortion.FULL_DAY,
          branchId: 'br-1',
        },
      ],
    });
    expect(result.dayStatus).toBe('NON_WORKING');
    expect(result.reasonCode).toBe('LEGACY_HOLIDAY');
  });

  it('resolves legacy half-day holiday as working + portion', () => {
    const date = new Date('2026-08-07T00:00:00.000Z');
    const result = resolveLegacyBusinessDay({
      businessDate: date,
      companyId: 'co-1',
      branchId: 'br-1',
      workingDays: [],
      holidays: [
        {
          id: 'h1',
          holidayName: 'Half',
          holidayDate: date,
          dayPortion: DayPortion.FIRST_HALF,
          branchId: null,
        },
      ],
    });
    expect(result.dayStatus).toBe('WORKING');
    expect(result.dayPortion).toBe(DayPortion.FIRST_HALF);
  });

  it('categorizes missing company working week', () => {
    const category = categorizeParityDifference({
      legacy: {
        dayStatus: 'WORKING',
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'LEGACY_WORKING_WEEK',
        reasonText: 'x',
        holidayId: null,
      },
      next: {
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'COMPANY_WEEK',
        reasonText: 'y',
        controllingEventId: null,
        resolutionTrace: [],
        sourceChecksum: 'abc',
      },
      hasCompanyWorkingWeek: false,
      timezoneValid: true,
      branchHasOverride: false,
    });
    expect(category).toBe('MISSING_COMPANY_WORKING_WEEK');
  });

  it('builds a multi-year shadow compare window', () => {
    const range = buildShadowCompareRange(new Date('2026-08-07T00:00:00.000Z'));
    expect(range.from.toISOString().slice(0, 10)).toBe('2025-08-07');
    expect(range.to.toISOString().slice(0, 10)).toBe('2028-02-07');
  });
});
