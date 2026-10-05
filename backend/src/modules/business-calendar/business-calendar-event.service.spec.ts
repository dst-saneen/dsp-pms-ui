import { BadRequestException } from '@nestjs/common';
import {
  BusinessCalendarScope,
  BusinessDayEffect,
  CalendarEventTargetType,
} from '@prisma/client';

import { BusinessCalendarEventService } from './business-calendar-event.service';

describe('BusinessCalendarEventService target and effect rules', () => {
  const prisma = {
    businessCalendarEventType: { findFirst: jest.fn() },
    businessCalendarEventCategory: { findFirst: jest.fn() },
    businessCalendarEventSource: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
    businessCalendarEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    businessCalendarEventTarget: { deleteMany: jest.fn() },
    businessCalendarVersion: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  const employeeDomainScope = {
    companyWhere: jest.fn(() => ({})),
    branchWhere: jest.fn(() => ({})),
    employeeWhere: jest.fn(() => ({})),
    assertCompanyInScope: jest.fn(),
  };
  const versions = {
    requireVersion: jest.fn(),
    assertDraftEditable: jest.fn(),
    refreshChecksum: jest.fn(),
  };

  const service = new BusinessCalendarEventService(
    prisma as never,
    employeeDomainScope as never,
    { log: jest.fn() } as never,
    { write: jest.fn() } as never,
    versions as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    versions.requireVersion.mockResolvedValue({
      id: 'v1',
      status: 'DRAFT',
      calendar: {
        companyId: 'co-1',
        branchId: null,
        scope: BusinessCalendarScope.COMPANY,
        defaultTimezone: 'Asia/Kolkata',
      },
    });
    prisma.businessCalendarEventType.findFirst.mockResolvedValue({
      id: 'type-holiday',
      eventTypeCode: 'HOLIDAY',
      allowsBusinessDayEffect: true,
    });
    prisma.businessCalendarEventCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
    });
    prisma.businessCalendarEventSource.findFirst.mockResolvedValue({
      id: 'src-1',
    });
  });

  it('rejects informational targets with business-day effects', async () => {
    prisma.department.findFirst.mockResolvedValue({
      id: 'dep-1',
      companyId: 'co-1',
    });

    await expect(
      service.createEvent(
        'v1',
        {
          eventTypeId: 'type-holiday',
          eventCategoryId: 'cat-1',
          eventSourceId: 'src-1',
          eventName: 'Dept day',
          allDay: true,
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          targets: [
            {
              targetType: CalendarEventTargetType.DEPARTMENT,
              companyId: 'co-1',
              departmentId: 'dep-1',
            },
          ],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects paidHoliday without non-working effect', async () => {
    await expect(
      service.createEvent(
        'v1',
        {
          eventTypeId: 'type-holiday',
          eventCategoryId: 'cat-1',
          eventSourceId: 'src-1',
          eventName: 'Paid?',
          allDay: true,
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          businessDayEffect: BusinessDayEffect.NONE,
          paidHoliday: true,
          targets: [
            {
              targetType: CalendarEventTargetType.COMPANY,
              companyId: 'co-1',
            },
          ],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects timed events without timezone', async () => {
    await expect(
      service.createEvent(
        'v1',
        {
          eventTypeId: 'type-holiday',
          eventCategoryId: 'cat-1',
          eventSourceId: 'src-1',
          eventName: 'Timed',
          allDay: false,
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          startsAt: '2026-08-15T09:00:00.000Z',
          endsAt: '2026-08-15T10:00:00.000Z',
          targets: [
            {
              targetType: CalendarEventTargetType.COMPANY,
              companyId: 'co-1',
            },
          ],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cross-company event targets', async () => {
    await expect(
      service.createEvent(
        'v1',
        {
          eventTypeId: 'type-holiday',
          eventCategoryId: 'cat-1',
          eventSourceId: 'src-1',
          eventName: 'Bad target',
          allDay: true,
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          targets: [
            {
              targetType: CalendarEventTargetType.COMPANY,
              companyId: 'other-co',
            },
          ],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('optional holiday rules', () => {
    const optionalBase = {
      eventTypeId: 'type-holiday',
      eventCategoryId: 'cat-1',
      eventSourceId: 'src-1',
      eventName: 'Floating day',
      allDay: true,
      startDate: '2026-10-10',
      endDate: '2026-10-10',
      businessDayEffect: BusinessDayEffect.NONE,
      paidHoliday: false,
      isOptionalHoliday: true,
      targets: [
        {
          targetType: CalendarEventTargetType.COMPANY,
          companyId: 'co-1',
        },
      ],
    };

    it('accepts a valid optional holiday', async () => {
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        Promise.resolve(
          fn({
            businessCalendarEvent: {
              create: jest.fn().mockResolvedValue({
                id: 'ev-1',
                ...optionalBase,
                companyId: 'co-1',
              }),
            },
            businessCalendarVersion: { update: jest.fn() },
          }),
        ),
      );
      versions.refreshChecksum.mockResolvedValue(undefined);

      await expect(
        service.createEvent('v1', optionalBase, 'user-1'),
      ).resolves.toMatchObject({ id: 'ev-1' });
    });

    it('defaults missing isOptionalHoliday to false for existing-style events', async () => {
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        Promise.resolve(
          fn({
            businessCalendarEvent: {
              create: jest
                .fn()
                .mockImplementation(({ data }) =>
                  Promise.resolve({ id: 'ev-2', ...data }),
                ),
            },
            businessCalendarVersion: { update: jest.fn() },
          }),
        ),
      );
      versions.refreshChecksum.mockResolvedValue(undefined);

      const created = await service.createEvent(
        'v1',
        {
          eventTypeId: 'type-holiday',
          eventCategoryId: 'cat-1',
          eventSourceId: 'src-1',
          eventName: 'Mandatory',
          allDay: true,
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          targets: [
            {
              targetType: CalendarEventTargetType.COMPANY,
              companyId: 'co-1',
            },
          ],
        },
        'user-1',
      );

      expect(created.isOptionalHoliday).toBe(false);
    });

    it('rejects optional on non-HOLIDAY event type', async () => {
      prisma.businessCalendarEventType.findFirst.mockResolvedValue({
        id: 'type-other',
        eventTypeCode: 'SPECIAL',
        allowsBusinessDayEffect: true,
      });

      await expect(
        service.createEvent(
          'v1',
          { ...optionalBase, eventTypeId: 'type-other' },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects optional when startDate != endDate', async () => {
      await expect(
        service.createEvent(
          'v1',
          { ...optionalBase, endDate: '2026-10-11' },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects optional timed or half-day events', async () => {
      await expect(
        service.createEvent(
          'v1',
          {
            ...optionalBase,
            allDay: false,
            startsAt: '2026-10-10T09:00:00.000Z',
            endsAt: '2026-10-10T17:00:00.000Z',
            eventTimezone: 'Asia/Kolkata',
          },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.createEvent(
          'v1',
          {
            ...optionalBase,
            businessDayEffect: BusinessDayEffect.FIRST_HALF_NON_WORKING,
          },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects optional with NON_WORKING_DAY or paidHoliday true', async () => {
      await expect(
        service.createEvent(
          'v1',
          {
            ...optionalBase,
            businessDayEffect: BusinessDayEffect.NON_WORKING_DAY,
          },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.createEvent(
          'v1',
          { ...optionalBase, paidHoliday: true },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects optional with DEPARTMENT, EMPLOYEE, or PROJECT target', async () => {
      prisma.department.findFirst.mockResolvedValue({
        id: 'dep-1',
        companyId: 'co-1',
      });

      await expect(
        service.createEvent(
          'v1',
          {
            ...optionalBase,
            targets: [
              {
                targetType: CalendarEventTargetType.DEPARTMENT,
                companyId: 'co-1',
                departmentId: 'dep-1',
              },
            ],
          },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
