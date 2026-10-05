import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
} from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants/workforce-error-codes';
import { HolidayService } from './holiday.service';

type VersionFindManyInput = {
  where: { calendarId: { in: string[] } };
};

type EventFindManyInput = {
  where: { calendarVersionId: { in: string[] } };
};

describe('HolidayService Business Calendar handoff', () => {
  const prisma = {
    company: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    branch: { findFirst: jest.fn(), findMany: jest.fn() },
    holiday: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    businessCalendar: { findMany: jest.fn() },
    businessCalendarVersion: { findMany: jest.fn() },
    businessCalendarEvent: { findMany: jest.fn() },
  };
  const employeeDomainScope = {
    assertCompanyInScope: jest.fn(),
    companyWhere: jest.fn().mockReturnValue({}),
    branchWhere: jest.fn().mockReturnValue({}),
    holidayWhere: jest.fn().mockReturnValue({}),
  };
  const service = new HolidayService(
    prisma as never,
    employeeDomainScope as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.companyWhere.mockReturnValue({});
    employeeDomainScope.branchWhere.mockReturnValue({});
    employeeDomainScope.holidayWhere.mockReturnValue({});
    prisma.company.findFirst.mockResolvedValue({ id: 'co-1' });
    prisma.branch.findFirst.mockResolvedValue({
      id: 'br-1',
      companyId: 'co-1',
    });
    prisma.holiday.findFirst.mockResolvedValue(null);
  });

  it('blocks creating a holiday after the office leaves LEGACY', async () => {
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-1',
        companyId: 'co-1',
        branchId: 'br-1',
        scope: BusinessCalendarScope.BRANCH,
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
      },
    ]);

    await expect(
      service.create({
        companyId: 'co-1',
        branchId: 'br-1',
        holidayName: 'Diwali',
        holidayDate: '2026-11-08',
        holidayType: 'PUBLIC',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it('still allows Leave → Holidays while the office is LEGACY', async () => {
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-1',
        companyId: 'co-1',
        branchId: 'br-1',
        scope: BusinessCalendarScope.BRANCH,
        runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
      },
    ]);
    prisma.holiday.create.mockResolvedValue({ id: 'hol-1' });

    await service.create({
      companyId: 'co-1',
      branchId: 'br-1',
      holidayName: 'Diwali',
      holidayDate: '2026-11-08',
      holidayType: 'PUBLIC',
    });

    expect(prisma.holiday.create).toHaveBeenCalled();
  });

  it('labels offices by source and mode', async () => {
    prisma.company.findMany.mockResolvedValue([
      { id: 'co-1', companyName: 'Acme' },
    ]);
    prisma.branch.findMany.mockResolvedValue([
      { id: 'br-1', companyId: 'co-1', branchName: 'HQ' },
      { id: 'br-2', companyId: 'co-1', branchName: 'Plant' },
    ]);
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-co',
        companyId: 'co-1',
        branchId: null,
        scope: BusinessCalendarScope.COMPANY,
        runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
      },
      {
        id: 'cal-br',
        companyId: 'co-1',
        branchId: 'br-1',
        scope: BusinessCalendarScope.BRANCH,
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
      },
    ]);

    const result = await service.listSources();

    expect(result.canEditLegacyHolidays).toBe(true);
    expect(result.offices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branchId: 'br-1',
          runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
          source: 'BUSINESS_CALENDAR',
          calendarId: 'cal-br',
        }),
        expect.objectContaining({
          branchId: 'br-2',
          runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
          source: 'LEGACY_HOLIDAYS',
        }),
      ]),
    );
  });

  it('uses the branch calendar as the effective published directory source', async () => {
    prisma.company.findMany.mockResolvedValue([
      { id: 'co-1', companyName: 'Acme', companyCode: 'ACME' },
    ]);
    prisma.branch.findFirst.mockResolvedValue({
      id: 'br-1',
      companyId: 'co-1',
    });
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-company',
        companyId: 'co-1',
        branchId: null,
        scope: BusinessCalendarScope.COMPANY,
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
        calendarName: 'Acme company calendar',
      },
      {
        id: 'cal-branch',
        companyId: 'co-1',
        branchId: 'br-1',
        scope: BusinessCalendarScope.BRANCH,
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
        calendarName: 'Acme HQ calendar',
      },
    ]);
    const publishedVersions = [
      {
        id: 'ver-company',
        calendarId: 'cal-company',
        versionNumber: 2,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        publishedAt: new Date('2026-01-10'),
      },
      {
        id: 'ver-branch',
        calendarId: 'cal-branch',
        versionNumber: 3,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        publishedAt: new Date('2026-01-11'),
      },
    ];
    prisma.businessCalendarVersion.findMany.mockImplementation(
      (input: VersionFindManyInput) =>
        Promise.resolve(
          publishedVersions.filter((version) =>
            input.where.calendarId.in.includes(version.calendarId),
          ),
        ),
    );
    const calendarEvents = [
      {
        id: 'event-company',
        eventCode: 'CO-HOL',
        eventName: 'Company holiday',
        startDate: new Date('2026-01-26'),
        endDate: new Date('2026-01-26'),
        description: null,
        paidHoliday: true,
        eventType: { eventTypeCode: 'HOLIDAY', eventTypeName: 'Holiday' },
        calendarVersion: {
          id: 'ver-company',
          versionNumber: 2,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          publishedAt: new Date('2026-01-10'),
          calendar: {
            id: 'cal-company',
            companyId: 'co-1',
            branchId: null,
            scope: BusinessCalendarScope.COMPANY,
            runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
            calendarName: 'Acme company calendar',
            company: { id: 'co-1', companyCode: 'ACME', companyName: 'Acme' },
            branch: null,
          },
        },
      },
      {
        id: 'event-branch',
        eventCode: 'HQ-HOL',
        eventName: 'HQ holiday',
        startDate: new Date('2026-01-26'),
        endDate: new Date('2026-01-26'),
        description: null,
        paidHoliday: true,
        eventType: { eventTypeCode: 'HOLIDAY', eventTypeName: 'Holiday' },
        calendarVersion: {
          id: 'ver-branch',
          versionNumber: 3,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          publishedAt: new Date('2026-01-11'),
          calendar: {
            id: 'cal-branch',
            companyId: 'co-1',
            branchId: 'br-1',
            scope: BusinessCalendarScope.BRANCH,
            runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
            calendarName: 'Acme HQ calendar',
            company: { id: 'co-1', companyCode: 'ACME', companyName: 'Acme' },
            branch: { id: 'br-1', branchCode: 'HQ', branchName: 'HQ' },
          },
        },
      },
    ];
    prisma.businessCalendarEvent.findMany.mockImplementation(
      (input: EventFindManyInput) =>
        Promise.resolve(
          calendarEvents.filter((event) =>
            input.where.calendarVersionId.in.includes(event.calendarVersion.id),
          ),
        ),
    );
    prisma.holiday.findMany.mockResolvedValue([]);

    const result = await service.listDirectory({
      branchId: 'br-1',
      year: 2026,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'event-branch',
        calendarId: 'cal-branch',
        calendarScope: BusinessCalendarScope.BRANCH,
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
        source: 'BUSINESS_CALENDAR',
        isTransitioning: false,
        publishedAt: new Date('2026-01-11'),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      }),
    ]);
  });

  it('lists holiday sources only for companies in tenant scope', async () => {
    employeeDomainScope.companyWhere.mockReturnValue({ id: 'co-1' });
    employeeDomainScope.branchWhere.mockReturnValue({ companyId: 'co-1' });
    prisma.company.findMany.mockResolvedValue([
      { id: 'co-1', companyName: 'Acme' },
    ]);
    prisma.branch.findMany.mockResolvedValue([]);
    prisma.businessCalendar.findMany.mockResolvedValue([]);

    await service.listSources();

    const companyCalls = prisma.company.findMany.mock.calls as unknown as Array<
      [{ where: { id: string } }]
    >;
    expect(companyCalls[0][0].where).toEqual({ id: 'co-1' });
  });

  it('404s a holiday outside holidayWhere tenant scope', async () => {
    employeeDomainScope.holidayWhere.mockReturnValue({ companyId: 'co-1' });
    prisma.holiday.findFirst.mockResolvedValue(null);

    await expect(service.findOne('hol-foreign')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const holidayCalls = prisma.holiday.findFirst.mock
      .calls as unknown as Array<
      [{ where: { id: string; companyId: string } }]
    >;
    expect(holidayCalls[0][0].where).toMatchObject({
      id: 'hol-foreign',
      companyId: 'co-1',
    });
  });

  it('surfaces HOLIDAY_MASTER_MOVED when deleting a moved office holiday', async () => {
    prisma.holiday.findFirst.mockResolvedValue({
      id: 'hol-1',
      companyId: 'co-1',
      branchId: 'br-1',
    });
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-1',
        companyId: 'co-1',
        branchId: 'br-1',
        scope: BusinessCalendarScope.BRANCH,
        runtimeMode: BusinessCalendarRuntimeMode.SHADOW,
      },
    ]);

    try {
      await service.remove('hol-1');
      fail('expected ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: WorkforceErrorCode.HOLIDAY_MASTER_MOVED,
      });
    }
  });
});
