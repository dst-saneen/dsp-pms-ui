import {
  BusinessDayEffect,
  BusinessDayStatus,
  DayPortion,
} from '@prisma/client';

import {
  eachDateInclusive,
  resolveBusinessDay,
} from './business-calendar-runtime.util';

/**
 * Stage 9 §20.2 — business-day boundary matrix (pure resolver).
 */
describe('Stage 9 business-day boundaries', () => {
  const companyWeek = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
    dayPortion: DayPortion.FULL_DAY,
    ruleMode: 'DEFINE',
  }));

  const base = {
    companyId: 'co-1',
    companyWeekRules: companyWeek,
    companyEvents: [] as never[],
    sourceChecksum: 'stage9',
  };

  it('company with no branch uses company week only', () => {
    const sunday = new Date('2026-08-09T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: sunday,
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(result.resolutionTrace.map((s) => s.layer)).toEqual([
      'COMPANY_WORKING_WEEK',
    ]);
  });

  it('branch inherits company weekday when no branch override', () => {
    const wednesday = new Date('2026-08-05T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-1',
      businessDate: wednesday,
      branchWeekRules: [],
      branchEvents: [],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(
      result.resolutionTrace.some((s) => s.layer === 'COMPANY_WORKING_WEEK'),
    ).toBe(true);
    expect(
      result.resolutionTrace.some((s) => s.layer === 'BRANCH_WORKING_WEEK'),
    ).toBe(false);
  });

  it('branch overrides weekday', () => {
    const wednesday = new Date('2026-08-05T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-1',
      businessDate: wednesday,
      branchWeekRules: [
        {
          dayOfWeek: 3,
          isWorkingDay: false,
          dayPortion: DayPortion.FULL_DAY,
          ruleMode: 'OVERRIDE',
        },
      ],
      branchEvents: [],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(
      result.resolutionTrace.some((s) => s.layer === 'BRANCH_WORKING_WEEK'),
    ).toBe(true);
  });

  it('company full-day holiday', () => {
    const day = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: day,
      companyEvents: [
        {
          id: 'co-hol',
          eventName: 'Company Holiday',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(result.dayPortion).toBe(DayPortion.FULL_DAY);
    expect(result.controllingEventId).toBe('co-hol');
  });

  it('branch full-day holiday', () => {
    const day = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-1',
      businessDate: day,
      branchWeekRules: [],
      branchEvents: [
        {
          id: 'br-hol',
          eventName: 'Branch Holiday',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'BRANCH', companyId: 'co-1', branchId: 'br-1' },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(result.controllingEventId).toBe('br-hol');
  });

  it('first-half holiday', () => {
    const day = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: day,
      companyEvents: [
        {
          id: 'half1',
          eventName: 'Morning off',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.FIRST_HALF_NON_WORKING,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.dayPortion).toBe(DayPortion.FIRST_HALF);
  });

  it('second-half holiday', () => {
    const day = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: day,
      companyEvents: [
        {
          id: 'half2',
          eventName: 'Afternoon off',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.SECOND_HALF_NON_WORKING,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.dayPortion).toBe(DayPortion.SECOND_HALF);
  });

  it('company special working-day override', () => {
    const sunday = new Date('2026-08-09T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: sunday,
      companyEvents: [
        {
          id: 'work-sun',
          eventName: 'Special Sunday',
          startDate: sunday,
          endDate: sunday,
          businessDayEffect: BusinessDayEffect.WORKING_DAY_OVERRIDE,
          paidHoliday: false,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.controllingEventId).toBe('work-sun');
  });

  it('branch special working-day override after company holiday', () => {
    const day = new Date('2026-08-03T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-1',
      businessDate: day,
      companyEvents: [
        {
          id: 'co-off',
          eventName: 'Company off',
          startDate: day,
          endDate: day,
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
          id: 'br-on',
          eventName: 'Branch open',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.WORKING_DAY_OVERRIDE,
          paidHoliday: false,
          targets: [
            { targetType: 'BRANCH', companyId: 'co-1', branchId: 'br-1' },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.controllingEventId).toBe('br-on');
  });

  it('company amendment holiday is inherited by branch (no branch event)', () => {
    const day = new Date('2026-08-15T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-1',
      businessDate: day,
      companyEvents: [
        {
          id: 'amend-hol',
          eventName: 'Amended Independence Day',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
      branchWeekRules: [],
      branchEvents: [],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(result.controllingEventId).toBe('amend-hol');
  });

  it('branch override remains after company amendment holiday', () => {
    const day = new Date('2026-08-15T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-1',
      businessDate: day,
      companyEvents: [
        {
          id: 'amend-hol',
          eventName: 'Company holiday',
          startDate: day,
          endDate: day,
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
          id: 'br-keep',
          eventName: 'Branch stays open',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.WORKING_DAY_OVERRIDE,
          paidHoliday: false,
          targets: [
            { targetType: 'BRANCH', companyId: 'co-1', branchId: 'br-1' },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.controllingEventId).toBe('br-keep');
  });

  it('leap day resolves on company week', () => {
    // 2028-02-29 is a Tuesday
    const leap = new Date('2028-02-29T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: leap,
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
  });

  it('year boundary inclusive range and New Year Sunday', () => {
    const days = eachDateInclusive(
      new Date('2026-12-31T00:00:00.000Z'),
      new Date('2027-01-01T00:00:00.000Z'),
    );
    expect(days.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-12-31',
      '2027-01-01',
    ]);
    // 2027-01-01 is Friday
    const nye = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: new Date('2027-01-01T00:00:00.000Z'),
    });
    expect(nye.dayStatus).toBe(BusinessDayStatus.WORKING);
  });

  it('cross-year event covers both years', () => {
    const day = new Date('2027-01-01T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: null,
      businessDate: day,
      companyEvents: [
        {
          id: 'nye-span',
          eventName: 'New Year span',
          startDate: new Date('2026-12-31T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'COMPANY', companyId: 'co-1', branchId: null },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(result.controllingEventId).toBe('nye-span');
  });

  it('India state-specific holiday targets only matching branch context via COMPANY+BRANCH layers', () => {
    const onam = new Date('2026-08-26T00:00:00.000Z');
    const kerala = resolveBusinessDay({
      ...base,
      branchId: 'br-kl',
      businessDate: onam,
      branchWeekRules: [],
      branchEvents: [
        {
          id: 'onam',
          eventName: 'Onam',
          startDate: onam,
          endDate: onam,
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          paidHoliday: true,
          targets: [
            { targetType: 'BRANCH', companyId: 'co-1', branchId: 'br-kl' },
          ],
        },
      ],
    });
    const other = resolveBusinessDay({
      ...base,
      branchId: 'br-mh',
      businessDate: onam,
      branchWeekRules: [],
      branchEvents: [],
    });
    expect(kerala.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(other.dayStatus).toBe(BusinessDayStatus.WORKING);
  });

  it('Middle East regional half-day holiday', () => {
    const day = new Date('2026-01-15T00:00:00.000Z');
    const result = resolveBusinessDay({
      ...base,
      branchId: 'br-dubai',
      businessDate: day,
      branchWeekRules: [],
      branchEvents: [
        {
          id: 'dsf',
          eventName: 'Dubai half day',
          startDate: day,
          endDate: day,
          businessDayEffect: BusinessDayEffect.FIRST_HALF_NON_WORKING,
          paidHoliday: false,
          targets: [
            { targetType: 'BRANCH', companyId: 'co-1', branchId: 'br-dubai' },
          ],
        },
      ],
    });
    expect(result.dayStatus).toBe(BusinessDayStatus.WORKING);
    expect(result.dayPortion).toBe(DayPortion.FIRST_HALF);
  });

  it('62-day inclusive range supports month calendar views', () => {
    const days = eachDateInclusive(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(days).toHaveLength(62);
  });

  it('single-day and multi-day resolve under performance budget', () => {
    const start = Date.now();
    for (let i = 0; i < 500; i += 1) {
      resolveBusinessDay({
        ...base,
        branchId: 'br-1',
        businessDate: new Date('2026-08-03T00:00:00.000Z'),
        branchWeekRules: [],
        branchEvents: [],
      });
    }
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
