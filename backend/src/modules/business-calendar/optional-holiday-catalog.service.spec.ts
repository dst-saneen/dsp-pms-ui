import {
  BusinessCalendarScope,
  BusinessDayEffect,
  DayPortion,
} from '@prisma/client';

import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import { OptionalHolidayCatalogService } from './optional-holiday-catalog.service';

function monFriRules() {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
    dayPortion: DayPortion.FULL_DAY,
    ruleMode: 'DEFINE',
  }));
}

function d(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

describe('OptionalHolidayCatalogService', () => {
  const prisma = {
    employee: { findUnique: jest.fn() },
    companyHolidayPolicy: { findFirst: jest.fn() },
    businessCalendar: { findFirst: jest.fn(), findMany: jest.fn() },
    businessCalendarVersion: { findMany: jest.fn() },
    leaveRequest: { findMany: jest.fn() },
  };
  const employeeDomainScope = {
    assertCompanyInScope: jest.fn().mockResolvedValue(undefined),
  };

  const service = new OptionalHolidayCatalogService(
    prisma as never,
    employeeDomainScope as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      isActive: true,
      companyId: 'co-1',
      branchId: 'br-1',
      branch: { id: 'br-1', timezone: 'Asia/Kolkata' },
    });
    prisma.companyHolidayPolicy.findFirst.mockResolvedValue({
      id: 'pol-1',
      companyId: 'co-1',
      year: 2027,
      maximumHolidayDays: 10,
      isActive: true,
    });
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    // company calendar then branch calendar
    prisma.businessCalendar.findFirst
      .mockResolvedValueOnce({ id: 'cal-co' })
      .mockResolvedValueOnce({ id: 'cal-br' });
  });

  function companyVersion(events: unknown[]) {
    return {
      id: 'v-co',
      versionNumber: 1,
      contentChecksum: 'co-checksum',
      effectiveFrom: d('2027-01-01'),
      effectiveTo: null,
      calendar: { scope: BusinessCalendarScope.COMPANY },
      workingWeekRules: monFriRules(),
      events,
    };
  }

  function branchVersion(events: unknown[]) {
    return {
      id: 'v-br',
      versionNumber: 1,
      contentChecksum: 'br-checksum',
      effectiveFrom: d('2027-01-01'),
      effectiveTo: null,
      calendar: { scope: BusinessCalendarScope.BRANCH },
      workingWeekRules: monFriRules(),
      events,
    };
  }

  function holidayEvent(input: {
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    isOptionalHoliday?: boolean;
    effect?: BusinessDayEffect;
    companyId?: string;
    targetType?: 'COMPANY' | 'BRANCH';
    branchId?: string | null;
  }) {
    return {
      id: input.id,
      eventName: input.name,
      startDate: d(input.startDate),
      endDate: d(input.endDate ?? input.startDate),
      businessDayEffect: input.effect ?? BusinessDayEffect.NON_WORKING_DAY,
      paidHoliday: !(input.isOptionalHoliday ?? false),
      isOptionalHoliday: input.isOptionalHoliday ?? false,
      allDay: true,
      eventType: { eventTypeCode: 'HOLIDAY' },
      targets: [
        {
          targetType: input.targetType ?? 'COMPANY',
          companyId: input.companyId ?? 'co-1',
          branchId:
            input.targetType === 'BRANCH' ? (input.branchId ?? 'br-1') : null,
        },
      ],
    };
  }

  it('computes optional allowance as maximum 10 minus mandatory 5', async () => {
    const mandatoryDates = [
      '2027-01-04', // Mon
      '2027-01-05',
      '2027-01-06',
      '2027-01-07',
      '2027-01-08', // Fri
    ];
    const optionalDates = [
      '2027-02-01', // Mon
      '2027-02-02',
      '2027-02-03',
      '2027-02-04',
      '2027-02-05',
      '2027-02-08',
    ];

    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          ...mandatoryDates.map((date, index) =>
            holidayEvent({
              id: `m-${index}`,
              name: `Mandatory ${index + 1}`,
              startDate: date,
            }),
          ),
          ...optionalDates.map((date, index) =>
            holidayEvent({
              id: `o-${index}`,
              name: `Optional ${index + 1}`,
              startDate: date,
              isOptionalHoliday: true,
              effect: BusinessDayEffect.NONE,
            }),
          ),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    const catalog = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(catalog.maximumHolidayDays).toBe(10);
    expect(catalog.mandatoryWorkingDayCount).toBe(5);
    expect(catalog.optionalAllowance).toBe(5);
    expect(catalog.holidays).toHaveLength(6);
    expect(catalog.remainingCount).toBe(5);
  });

  it('lets mandatory win over optional on the same date', async () => {
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'opt',
            name: 'Optional conflict',
            startDate: '2027-03-01', // Mon
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
          }),
        ]),
      ])
      .mockResolvedValueOnce([
        branchVersion([
          holidayEvent({
            id: 'man',
            name: 'Mandatory conflict',
            startDate: '2027-03-01',
            targetType: 'BRANCH',
          }),
        ]),
      ]);

    const catalog = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(catalog.mandatoryWorkingDayCount).toBe(1);
    expect(catalog.holidays).toHaveLength(0);
  });

  it('does not reduce allowance for a mandatory holiday on Sunday', async () => {
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'sun',
            name: 'Sunday mandatory',
            startDate: '2027-01-03', // Sunday
          }),
          holidayEvent({
            id: 'opt',
            name: 'Optional Mon',
            startDate: '2027-01-04',
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
          }),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    const catalog = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(catalog.mandatoryWorkingDayCount).toBe(0);
    expect(catalog.optionalAllowance).toBe(10);
    expect(catalog.holidays.map((h) => h.date)).toEqual(['2027-01-04']);
  });

  it('omits optional dates that fall on a week-off', async () => {
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'sat',
            name: 'Saturday optional',
            startDate: '2027-01-02', // Saturday
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
          }),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    const catalog = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(catalog.holidays).toHaveLength(0);
  });

  it('omits wrong-company event targets', async () => {
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'other',
            name: 'Other company',
            startDate: '2027-01-04',
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
            companyId: 'co-other',
          }),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    const catalog = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(catalog.holidays).toHaveLength(0);
  });

  it('locks October 10 at branch-local midnight and keeps Oct 9 editable', async () => {
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'oct10',
            name: 'Diwali float',
            startDate: '2027-10-11', // Monday (working)
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
          }),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    // 2027-10-10 is Sunday in UTC date key; use 2027-10-11 holiday.
    // Asia/Kolkata: 2027-10-10T18:30:00.000Z == 2027-10-11 00:00 IST
    const locked = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-10-10T18:30:00.000Z'),
    });
    expect(locked.holidays[0]?.locked).toBe(true);
    expect(locked.holidays[0]?.editableUntil).toBe('2027-10-10T23:59:59');

    prisma.businessCalendar.findFirst
      .mockResolvedValueOnce({ id: 'cal-co' })
      .mockResolvedValueOnce({ id: 'cal-br' });
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'oct10',
            name: 'Diwali float',
            startDate: '2027-10-11',
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
          }),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    // Still 2027-10-10 in IST (before midnight of holiday)
    const editable = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-10-10T18:29:59.000Z'),
    });
    expect(editable.holidays[0]?.locked).toBe(false);
  });

  it('throws when mandatory working days exceed the company maximum', async () => {
    prisma.companyHolidayPolicy.findFirst.mockResolvedValue({
      id: 'pol-1',
      companyId: 'co-1',
      year: 2027,
      maximumHolidayDays: 2,
      isActive: true,
    });

    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({ id: 'm1', name: 'M1', startDate: '2027-01-04' }),
          holidayEvent({ id: 'm2', name: 'M2', startDate: '2027-01-05' }),
          holidayEvent({ id: 'm3', name: 'M3', startDate: '2027-01-06' }),
        ]),
      ])
      .mockResolvedValueOnce([branchVersion([])]);

    await expect(
      service.getCatalog({ employeeId: 'emp-1', year: 2027 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: BusinessCalendarErrorCode.HOLIDAY_POLICY_MAX_BELOW_MANDATORY,
      }) as unknown,
    });
  });

  it('dedupes company/branch duplicate optional dates preferring branch', async () => {
    prisma.businessCalendarVersion.findMany
      .mockResolvedValueOnce([
        companyVersion([
          holidayEvent({
            id: 'co-opt',
            name: 'Company optional',
            startDate: '2027-04-05', // Mon
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
          }),
        ]),
      ])
      .mockResolvedValueOnce([
        branchVersion([
          holidayEvent({
            id: 'br-opt',
            name: 'Branch optional',
            startDate: '2027-04-05',
            isOptionalHoliday: true,
            effect: BusinessDayEffect.NONE,
            targetType: 'BRANCH',
          }),
        ]),
      ]);

    const catalog = await service.getCatalog({
      employeeId: 'emp-1',
      year: 2027,
      asOf: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(catalog.holidays).toHaveLength(1);
    expect(catalog.holidays[0]?.eventId).toBe('br-opt');
    expect(catalog.holidays[0]?.calendarScope).toBe('BRANCH');
  });
});
