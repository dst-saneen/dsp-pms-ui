import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
} from '@prisma/client';

import { BusinessCalendarAdminService } from './business-calendar-admin.service';

describe('BusinessCalendarAdminService', () => {
  const prisma = {
    company: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    businessCalendar: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const employeeDomainScope = {
    companyWhere: jest.fn(() => ({})),
    branchWhere: jest.fn(() => ({})),
    assertCompanyInScope: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const outboxWriter = { write: jest.fn() };

  const service = new BusinessCalendarAdminService(
    prisma as never,
    employeeDomainScope as never,
    auditService as never,
    outboxWriter as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existing company calendar idempotently', async () => {
    const existing = {
      id: 'cal-1',
      companyId: 'co-1',
      branchId: null,
      scope: BusinessCalendarScope.COMPANY,
      scopeKey: 'COMPANY:co-1',
      calendarCode: 'MAIN',
      calendarName: 'Company Calendar',
      defaultTimezone: 'Asia/Kolkata',
      runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
      isActive: true,
      company: { id: 'co-1', companyCode: 'C1', companyName: 'Co' },
      branch: null,
      parentCalendar: null,
      childCalendars: [],
    };
    prisma.company.findFirst.mockResolvedValue({ id: 'co-1' });
    prisma.businessCalendar.findFirst.mockResolvedValue(existing);

    const result = await service.provisionCompanyCalendar(
      {
        companyId: 'co-1',
        calendarCode: 'MAIN',
        calendarName: 'Company Calendar',
        defaultTimezone: 'Asia/Kolkata',
      },
      'user-1',
    );

    expect(result.created).toBe(false);
    expect(result.calendar.id).toBe('cal-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects branch calendar when timezone is invalid', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'br-1',
      companyId: 'co-1',
      branchCode: 'BR1',
      branchName: 'Branch',
      timezone: 'not-a-zone',
      company: { id: 'co-1' },
    });

    await expect(
      service.provisionBranchCalendar({ branchId: 'br-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects branch calendar when company calendar missing', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'br-1',
      companyId: 'co-1',
      branchCode: 'BR1',
      branchName: 'Branch',
      timezone: 'Asia/Kolkata',
      company: { id: 'co-1' },
    });
    prisma.businessCalendar.findFirst.mockResolvedValue(null);

    await expect(
      service.provisionBranchCalendar({ branchId: 'br-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ensure dry-run plans company and branch creates', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'co-1',
      companyCode: 'COM',
      companyName: 'Company',
      branches: [
        {
          id: 'br-1',
          branchCode: 'BR1',
          timezone: 'UTC',
        },
      ],
    });
    prisma.businessCalendar.findFirst.mockResolvedValue(null);

    const result = await service.ensureOfficeCalendars(
      { companyId: 'co-1', dryRun: true },
      'user-1',
    );

    expect(result.dryRun).toBe(true);
    expect(
      result.plan.some((p) => p.action === 'CREATE_COMPANY_CALENDAR'),
    ).toBe(true);
    expect(result.plan.some((p) => p.action === 'CREATE_BRANCH_CALENDAR')).toBe(
      true,
    );
  });

  it('rejects company calendar creation when neither input nor branches provide a valid timezone', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'co-1',
      companyCode: 'COM',
      companyName: 'Company',
      branches: [
        {
          id: 'br-1',
          branchCode: 'BR1',
          timezone: 'not-a-zone',
        },
      ],
    });
    prisma.businessCalendar.findFirst.mockResolvedValue(null);

    let caught: unknown;
    try {
      await service.ensureOfficeCalendars(
        { companyId: 'co-1', dryRun: false },
        'user-1',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toMatchObject({
      code: 'BUSINESS_CALENDAR_TIMEZONE_INVALID',
    });
  });

  it('requires an explicit company timezone when active branches disagree', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'co-1',
      companyCode: 'COM',
      companyName: 'Company',
      branches: [
        {
          id: 'br-1',
          branchCode: 'BR1',
          timezone: 'Asia/Kolkata',
        },
        {
          id: 'br-2',
          branchCode: 'BR2',
          timezone: 'Asia/Dubai',
        },
      ],
    });
    prisma.businessCalendar.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureOfficeCalendars(
        { companyId: 'co-1', dryRun: true },
        'user-1',
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'BUSINESS_CALENDAR_TIMEZONE_INVALID',
      },
    });
  });

  it('uses explicitly supplied UTC rather than inventing a company timezone', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'co-1',
      companyCode: 'COM',
      companyName: 'Company',
      branches: [],
    });
    prisma.businessCalendar.findFirst.mockResolvedValue(null);
    const provision = jest
      .spyOn(service, 'provisionCompanyCalendar')
      .mockResolvedValue({ created: true, calendar: { id: 'cal-1' } } as never);

    const result = await service.ensureOfficeCalendars(
      { companyId: 'co-1', dryRun: false, defaultTimezone: 'UTC' },
      'user-1',
    );

    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'co-1',
        defaultTimezone: 'UTC',
      }),
      'user-1',
    );
    expect(result.created).toHaveLength(1);
    provision.mockRestore();
  });

  it('getOne throws when missing', async () => {
    prisma.businessCalendar.findFirst.mockResolvedValue(null);
    await expect(service.getOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports whether a calendar has a published version', async () => {
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-1',
        companyId: 'co-1',
        branchId: null,
        scope: BusinessCalendarScope.COMPANY,
        scopeKey: 'COMPANY:co-1',
        calendarCode: 'MAIN',
        calendarName: 'Company Calendar',
        defaultTimezone: 'Asia/Kolkata',
        runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
        isActive: true,
        company: { id: 'co-1', companyCode: 'C1', companyName: 'Co' },
        branch: null,
        parentCalendar: null,
        childCalendars: [],
        versions: [],
      },
    ]);

    const [calendar] = await service.list({ companyId: 'co-1' });

    expect(calendar).toMatchObject({
      id: 'cal-1',
      hasPublishedVersion: false,
    });
  });
});
