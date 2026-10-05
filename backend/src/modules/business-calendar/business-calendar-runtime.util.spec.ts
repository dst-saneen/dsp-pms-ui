import {
  BusinessDayEffect,
  BusinessDayStatus,
  DayPortion,
} from '@prisma/client';

import {
  eachDateInclusive,
  isHolidayRuntimeDay,
  resolveBusinessDay,
} from './business-calendar-runtime.util';

describe('resolveBusinessDay', () => {
  const companyWeek = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
    dayPortion: DayPortion.FULL_DAY,
    ruleMode: 'DEFINE',
  }));

  it('uses company working week by default', () => {
    const monday = new Date('2026-08-03T00:00:00.000Z'); // Monday
    const result = resolveBusinessDay({
      companyId: 'co-1',
      branchId: null,
      businessDate: monday,
      companyWeekRules: companyWeek,
      companyEvents: [],
      sourceChecksum: 'abc',
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.resolutionTrace[0].layer).toBe('COMPANY_WORKING_WEEK');
  });

  it('applies company holiday over working week', () => {
    const monday = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      companyId: 'co-1',
      branchId: null,
      businessDate: monday,
      companyWeekRules: companyWeek,
      companyEvents: [
        {
          id: 'e1',
          eventName: 'Company Holiday',
          startDate: monday,
          endDate: monday,
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
      sourceChecksum: 'abc',
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(result.controllingEventId).toBe('e1');
    expect(
      result.resolutionTrace.some((s) => s.layer === 'COMPANY_EVENT'),
    ).toBe(true);
  });

  it('lets branch week override company week', () => {
    const friday = new Date('2026-08-07T00:00:00.000Z');
    const result = resolveBusinessDay({
      companyId: 'co-1',
      branchId: 'br-1',
      businessDate: friday,
      companyWeekRules: companyWeek,
      companyEvents: [],
      branchWeekRules: [
        {
          dayOfWeek: 5,
          isWorkingDay: false,
          dayPortion: DayPortion.FULL_DAY,
          ruleMode: 'OVERRIDE',
        },
      ],
      branchEvents: [],
      sourceChecksum: 'abc',
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(
      result.resolutionTrace.some((s) => s.layer === 'BRANCH_WORKING_WEEK'),
    ).toBe(true);
  });

  it('lets branch holiday override company holiday', () => {
    const monday = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      companyId: 'co-1',
      branchId: 'br-1',
      businessDate: monday,
      companyWeekRules: companyWeek,
      companyEvents: [
        {
          id: 'ce',
          eventName: 'Company off',
          startDate: monday,
          endDate: monday,
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
      branchWeekRules: [],
      branchEvents: [
        {
          id: 'be',
          eventName: 'Branch working override',
          startDate: monday,
          endDate: monday,
          businessDayEffect: BusinessDayEffect.WORKING_DAY_OVERRIDE,
          paidHoliday: false,
          targets: [
            { targetType: 'BRANCH', companyId: 'co-1', branchId: 'br-1' },
          ],
        },
      ],
      sourceChecksum: 'abc',
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.controllingEventId).toBe('be');
  });

  it('eachDateInclusive returns inclusive days', () => {
    const days = eachDateInclusive(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-03T00:00:00.000Z'),
    );
    expect(days).toHaveLength(3);
  });
});

describe('isHolidayRuntimeDay', () => {
  it('treats non-working EVENT and LEGACY_HOLIDAY as holidays', () => {
    expect(
      isHolidayRuntimeDay({
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'EVENT',
      }),
    ).toBe(true);
    expect(
      isHolidayRuntimeDay({
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'LEGACY_HOLIDAY',
      }),
    ).toBe(true);
  });

  it('does not treat week-off or working-day override as holidays', () => {
    expect(
      isHolidayRuntimeDay({
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'COMPANY_WEEK',
      }),
    ).toBe(false);
    expect(
      isHolidayRuntimeDay({
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'EVENT',
      }),
    ).toBe(false);
  });

  it('treats half-day EVENT rows as holidays', () => {
    expect(
      isHolidayRuntimeDay({
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FIRST_HALF,
        reasonCode: 'EVENT',
      }),
    ).toBe(true);
  });
});
