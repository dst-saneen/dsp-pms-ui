/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BusinessCalendarRuntimeMode,
  BusinessDayStatus,
  DayPortion,
  ShiftRosterDayType,
} from '@prisma/client';

import { BusinessCalendarConsumerService } from './business-calendar-consumer.service';

describe('BusinessCalendarConsumerService', () => {
  const prisma = {
    businessCalendar: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    businessCalendarVersion: {
      findFirst: jest.fn(),
    },
    businessCalendarRuntimeDay: {
      findMany: jest.fn(),
    },
  };
  const runtime = {
    rebuild: jest.fn(),
    previewDay: jest.fn(),
    previewRange: jest.fn(),
  };
  const employeeDomainScope = {
    assertCompanyInScope: jest.fn(),
  };

  const service = new BusinessCalendarConsumerService(
    prisma as never,
    runtime as never,
    employeeDomainScope as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers branch calendar runtime mode over company', async () => {
    prisma.businessCalendar.findFirst.mockResolvedValueOnce({
      id: 'branch-cal',
      runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
    });

    const result = await service.resolveOfficeRuntimeMode('co-1', 'br-1');
    expect(result).toEqual({
      mode: BusinessCalendarRuntimeMode.ACTIVE,
      calendarId: 'branch-cal',
    });
    expect(prisma.businessCalendar.findFirst).toHaveBeenCalledTimes(1);
  });

  it('requires a reviewed calendar comparison before activation', async () => {
    prisma.businessCalendar.findFirst.mockResolvedValue({
      id: 'cal-1',
      runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
    });
    prisma.businessCalendarVersion.findFirst.mockResolvedValue({ id: 'v1' });

    await expect(
      service.setOfficeRuntimeMode({
        companyId: 'co-1',
        branchId: 'br-1',
        mode: BusinessCalendarRuntimeMode.ACTIVE,
        actorUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BUSINESS_CALENDAR_VERSION_NOT_EDITABLE',
        message:
          'Complete the reviewed calendar comparison before activating this calendar.',
      }),
    });
  });

  it('requires a published calendar version before starting the testing mode', async () => {
    prisma.businessCalendar.findFirst.mockResolvedValue({
      id: 'cal-1',
      runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
    });
    prisma.businessCalendarVersion.findFirst.mockResolvedValue(null);

    await expect(
      service.setOfficeRuntimeMode({
        companyId: 'co-1',
        mode: BusinessCalendarRuntimeMode.SHADOW,
        actorUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BUSINESS_CALENDAR_VERSION_NOT_EDITABLE',
        message: 'Publish a calendar version before testing or activating it.',
      }),
    });
    expect(prisma.businessCalendar.update).not.toHaveBeenCalled();
  });

  it('checks the requested company scope before changing a calendar mode', async () => {
    employeeDomainScope.assertCompanyInScope.mockRejectedValue(
      new Error('Company is outside the active scope'),
    );

    await expect(
      service.setOfficeRuntimeMode({
        companyId: 'other-company',
        mode: BusinessCalendarRuntimeMode.SHADOW,
        actorUserId: 'user-1',
      }),
    ).rejects.toThrow('Company is outside the active scope');

    expect(prisma.businessCalendar.findFirst).not.toHaveBeenCalled();
  });

  it('maps holiday half-day to scheduled half day roster type', () => {
    const mapped = service.mapRosterDayType({
      date: '2026-08-03',
      dayStatus: BusinessDayStatus.WORKING,
      dayPortion: DayPortion.FIRST_HALF,
      kind: 'HOLIDAY',
      reasonCode: 'EVENT',
      reasonText: 'Half holiday',
      runtimeDayId: 'rd-1',
      controllingEventId: 'ev-1',
    });
    expect(mapped.dayType).toBe(ShiftRosterDayType.SCHEDULED_HALF_DAY);
    expect(mapped.dayPortion).toBe(DayPortion.FIRST_HALF);
  });

  it('summarizes leave charges excluding holidays and week offs', () => {
    const days = new Map([
      [
        '2026-08-03',
        {
          date: '2026-08-03',
          dayStatus: BusinessDayStatus.WORKING,
          dayPortion: DayPortion.FULL_DAY,
          kind: 'WORKING' as const,
          reasonCode: 'WEEK',
          reasonText: 'Working',
          runtimeDayId: 'rd-1',
          controllingEventId: null,
        },
      ],
      [
        '2026-08-04',
        {
          date: '2026-08-04',
          dayStatus: BusinessDayStatus.NON_WORKING,
          dayPortion: DayPortion.FULL_DAY,
          kind: 'HOLIDAY' as const,
          reasonCode: 'EVENT',
          reasonText: 'Holiday',
          runtimeDayId: 'rd-2',
          controllingEventId: 'ev-1',
        },
      ],
      [
        '2026-08-05',
        {
          date: '2026-08-05',
          dayStatus: BusinessDayStatus.WORKING,
          dayPortion: DayPortion.SECOND_HALF,
          kind: 'HALF_DAY' as const,
          reasonCode: 'WEEK',
          reasonText: 'Half',
          runtimeDayId: 'rd-3',
          controllingEventId: null,
        },
      ],
    ]);

    const summary = service.summarizeLeaveDays(days, false);
    expect(summary.requestedWorkingDays).toBe(1.5);
    expect(summary.excludedHolidays).toEqual(['2026-08-04']);
    expect(summary.snapshots).toHaveLength(3);
  });

  it('fills missing runtime days with one range preview, not per-day preview', async () => {
    prisma.businessCalendar.findFirst.mockResolvedValue({
      id: 'cal-1',
      scopeKey: 'co-1',
    });
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([
      {
        id: 'rd-1',
        businessDate: new Date('2026-08-03T00:00:00.000Z'),
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'WEEK',
        reasonText: 'Working',
        controllingEventId: null,
      },
    ]);
    runtime.rebuild.mockResolvedValue({ written: 0, skipped: 1 });
    runtime.previewRange.mockResolvedValue([
      {
        businessDate: '2026-08-03',
        result: {
          dayStatus: BusinessDayStatus.WORKING,
          dayPortion: DayPortion.FULL_DAY,
          reasonCode: 'WEEK',
          reasonText: 'Working',
          controllingEventId: null,
        },
      },
      {
        businessDate: '2026-08-04',
        result: {
          dayStatus: BusinessDayStatus.NON_WORKING,
          dayPortion: DayPortion.FULL_DAY,
          reasonCode: 'EVENT',
          reasonText: 'Holiday',
          controllingEventId: 'ev-1',
        },
      },
      {
        businessDate: '2026-08-05',
        result: {
          dayStatus: BusinessDayStatus.WORKING,
          dayPortion: DayPortion.FULL_DAY,
          reasonCode: 'WEEK',
          reasonText: 'Working',
          controllingEventId: null,
        },
      },
    ]);

    const days = await service.resolveConsumerDays({
      companyId: 'co-1',
      branchId: 'br-1',
      from: '2026-08-03',
      to: '2026-08-05',
    });

    expect(runtime.previewDay).not.toHaveBeenCalled();
    expect(runtime.previewRange).toHaveBeenCalledTimes(1);
    expect(runtime.previewRange).toHaveBeenCalledWith(
      {
        companyId: 'co-1',
        branchId: 'br-1',
        from: '2026-08-04',
        to: '2026-08-05',
      },
      prisma,
    );
    expect(days.get('2026-08-03')?.kind).toBe('WORKING');
    expect(days.get('2026-08-04')?.kind).toBe('HOLIDAY');
    expect(days.get('2026-08-05')?.kind).toBe('WORKING');
  });
});
