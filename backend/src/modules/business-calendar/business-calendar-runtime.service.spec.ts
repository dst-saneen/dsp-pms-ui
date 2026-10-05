import {
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  BusinessDayEffect,
  BusinessDayStatus,
  DayPortion,
} from '@prisma/client';

import { BusinessCalendarRuntimeService } from './business-calendar-runtime.service';

describe('BusinessCalendarRuntimeService range preview', () => {
  const companyCalendar = {
    id: 'cal-1',
    companyId: 'co-1',
    branchId: null,
    scope: BusinessCalendarScope.COMPANY,
    scopeKey: 'COMPANY:co-1',
    defaultTimezone: 'UTC',
    isActive: true,
  };

  const companyWeek = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
    dayPortion: DayPortion.FULL_DAY,
    ruleMode: 'DEFINE',
  }));

  const publishedVersion = {
    id: 'ver-1',
    calendarId: 'cal-1',
    contentChecksum: 'checksum-1',
    status: BusinessCalendarVersionStatus.PUBLISHED,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    versionNumber: 1,
    workingWeekRules: companyWeek,
    events: [
      {
        id: 'e-holiday',
        eventName: 'Company Holiday',
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-04T00:00:00.000Z'),
        businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
        paidHoliday: true,
        targets: [{ targetType: 'COMPANY', companyId: 'co-1', branchId: null }],
      },
    ],
    calendar: companyCalendar,
  };

  const prisma = {
    businessCalendar: {
      findFirst: jest.fn(),
    },
    businessCalendarVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    businessCalendarRuntimeDay: {
      findMany: jest.fn(),
    },
  };

  const employeeDomainScope = {
    assertCompanyInScope: jest.fn(),
    branchWhere: jest.fn(() => ({})),
  };

  const service = new BusinessCalendarRuntimeService(
    prisma as never,
    employeeDomainScope as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.businessCalendar.findFirst.mockResolvedValue(companyCalendar);
    prisma.businessCalendarVersion.findFirst.mockResolvedValue(
      publishedVersion,
    );
    prisma.businessCalendarVersion.findMany.mockResolvedValue([
      publishedVersion,
    ]);
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([]);
  });

  it('loads published versions once for a range instead of previewing each day', async () => {
    const previewDay = jest.spyOn(service, 'previewDay');

    const days = await service.previewRange({
      companyId: 'co-1',
      from: '2026-08-03',
      to: '2026-08-05',
    });

    expect(previewDay).not.toHaveBeenCalled();
    expect(prisma.businessCalendarVersion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.businessCalendarVersion.findFirst).not.toHaveBeenCalled();
    expect(days.map((day) => day.businessDate)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
    expect(days[1]?.result.dayStatus).toBe(BusinessDayStatus.NON_WORKING);
    expect(days[1]?.result.controllingEventId).toBe('e-holiday');
  });

  it('matches single-date preview for each day in the batch', async () => {
    const range = await service.previewRange({
      companyId: 'co-1',
      from: '2026-08-03',
      to: '2026-08-05',
    });

    for (const row of range) {
      const single = await service.previewDay({
        companyId: 'co-1',
        date: row.businessDate,
      });
      expect(row.result).toEqual(single.result);
    }
  });

  it('fills getRange gaps from one range preview, not per-day preview', async () => {
    const previewDay = jest.spyOn(service, 'previewDay');
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([
      {
        businessDate: new Date('2026-08-03T00:00:00.000Z'),
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'WEEK',
        reasonText: 'Working',
        resolutionTrace: [],
      },
    ]);

    const result = await service.getRange({
      companyId: 'co-1',
      from: '2026-08-03',
      to: '2026-08-05',
    });

    expect(previewDay).not.toHaveBeenCalled();
    expect(result.materializedCount).toBe(1);
    expect(result.previewCount).toBe(2);
    expect(result.days[1]).toEqual(
      expect.objectContaining({
        materialized: false,
        businessDate: '2026-08-04',
        dayStatus: BusinessDayStatus.NON_WORKING,
      }),
    );
  });
});
