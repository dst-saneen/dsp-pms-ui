import {
  buildVersionChecksumPayload,
  computeVersionContentChecksum,
} from './business-calendar-checksum.util';

describe('business-calendar-checksum', () => {
  it('is deterministic regardless of input order', () => {
    const a = computeVersionContentChecksum(
      buildVersionChecksumPayload({
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        workingWeekRules: [
          {
            dayOfWeek: 1,
            ruleMode: 'DEFINE',
            isWorkingDay: true,
            dayPortion: 'FULL_DAY',
            reason: null,
          },
          {
            dayOfWeek: 0,
            ruleMode: 'DEFINE',
            isWorkingDay: false,
            dayPortion: 'FULL_DAY',
          },
        ],
        events: [
          {
            eventName: 'B',
            eventTypeId: 't2',
            eventCategoryId: 'c1',
            eventSourceId: 's1',
            allDay: true,
            startDate: '2026-08-15',
            endDate: '2026-08-15',
            businessDayEffect: 'NON_WORKING_DAY',
            paidHoliday: true,
            isProtected: false,
            targets: [{ targetType: 'COMPANY', companyId: 'co-1' }],
          },
          {
            eventName: 'A',
            eventTypeId: 't1',
            eventCategoryId: 'c1',
            eventSourceId: 's1',
            allDay: true,
            startDate: '2026-01-26',
            endDate: '2026-01-26',
            businessDayEffect: 'NON_WORKING_DAY',
            paidHoliday: true,
            isProtected: false,
            targets: [
              {
                targetType: 'BRANCH',
                companyId: 'co-1',
                branchId: 'br-1',
              },
            ],
          },
        ],
      }),
    );

    const b = computeVersionContentChecksum(
      buildVersionChecksumPayload({
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
        workingWeekRules: [
          {
            dayOfWeek: 0,
            ruleMode: 'DEFINE',
            isWorkingDay: false,
            dayPortion: 'FULL_DAY',
            reason: null,
          },
          {
            dayOfWeek: 1,
            ruleMode: 'DEFINE',
            isWorkingDay: true,
            dayPortion: 'FULL_DAY',
            reason: null,
          },
        ],
        events: [
          {
            eventName: 'A',
            eventTypeId: 't1',
            eventCategoryId: 'c1',
            eventSourceId: 's1',
            allDay: true,
            startDate: new Date('2026-01-26T00:00:00.000Z'),
            endDate: new Date('2026-01-26T00:00:00.000Z'),
            businessDayEffect: 'NON_WORKING_DAY',
            paidHoliday: true,
            isProtected: false,
            targets: [
              {
                targetType: 'BRANCH',
                companyId: 'co-1',
                branchId: 'br-1',
              },
            ],
          },
          {
            eventName: 'B',
            eventTypeId: 't2',
            eventCategoryId: 'c1',
            eventSourceId: 's1',
            allDay: true,
            startDate: '2026-08-15',
            endDate: '2026-08-15',
            businessDayEffect: 'NON_WORKING_DAY',
            paidHoliday: true,
            isProtected: false,
            targets: [{ targetType: 'COMPANY', companyId: 'co-1' }],
          },
        ],
      }),
    );

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when content changes', () => {
    const base = buildVersionChecksumPayload({
      effectiveFrom: '2026-01-01',
      workingWeekRules: [],
      events: [],
    });
    const changed = buildVersionChecksumPayload({
      effectiveFrom: '2026-01-02',
      workingWeekRules: [],
      events: [],
    });
    expect(computeVersionContentChecksum(base)).not.toBe(
      computeVersionContentChecksum(changed),
    );
  });
});
