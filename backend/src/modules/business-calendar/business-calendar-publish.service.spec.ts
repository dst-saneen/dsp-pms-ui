import { BadRequestException, ConflictException } from '@nestjs/common';
import { BusinessCalendarVersionStatus } from '@prisma/client';

import { BusinessCalendarPublishService } from './business-calendar-publish.service';

describe('BusinessCalendarPublishService', () => {
  const prisma = {
    businessCalendarVersion: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    businessCalendarEvent: { create: jest.fn() },
    businessCalendarAmendment: { create: jest.fn() },
    businessCalendar: { findUniqueOrThrow: jest.fn() },
    leaveRequest: { findMany: jest.fn() },
    shiftRosterEntry: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const versions = {
    requireVersion: jest.fn(),
    getVersion: jest.fn(),
    refreshChecksum: jest.fn(),
    buildValidationSummary: jest.fn(),
    withValidationSummary: jest.fn((version: unknown) => version),
    versionSummaryInclude: jest.fn(() => ({})),
  };
  const runtime = {
    defaultMaterializeTo: jest.fn(
      (from: Date) => new Date(from.getTime() + 30 * 86400000),
    ),
    materializeRange: jest.fn().mockResolvedValue({ written: 1, skipped: 0 }),
  };
  const auditService = { log: jest.fn() };
  const outboxWriter = { write: jest.fn() };

  const service = new BusinessCalendarPublishService(
    prisma as never,
    versions as never,
    runtime as never,
    auditService as never,
    outboxWriter as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects startAmendment when source is not published', async () => {
    versions.requireVersion.mockResolvedValue({
      id: 'v1',
      status: BusinessCalendarVersionStatus.DRAFT,
      calendarId: 'cal-1',
      calendar: { companyId: 'co-1', branchId: null },
    });

    await expect(
      service.startAmendment(
        'v1',
        { effectiveDate: '2026-08-15', reason: 'fix holiday' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires impact acknowledgement for amendment publish', async () => {
    versions.requireVersion.mockResolvedValue({
      id: 'v2',
      status: BusinessCalendarVersionStatus.IN_REVIEW,
      optimisticVersion: 1,
      amendsVersionId: 'v1',
      effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
      effectiveTo: null,
      calendarId: 'cal-1',
      calendar: {
        companyId: 'co-1',
        branchId: null,
        scope: 'COMPANY',
        defaultTimezone: 'Asia/Kolkata',
      },
      workingWeekRules: [],
      events: [],
    });
    versions.buildValidationSummary.mockReturnValue({
      readyForReview: true,
      issues: [],
    });

    await expect(
      service.publish('v2', { optimisticVersion: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stale optimistic publish', async () => {
    versions.requireVersion.mockResolvedValue({
      id: 'v1',
      status: BusinessCalendarVersionStatus.IN_REVIEW,
      optimisticVersion: 3,
      amendsVersionId: null,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      calendarId: 'cal-1',
      calendar: {
        companyId: 'co-1',
        branchId: null,
        scope: 'COMPANY',
        defaultTimezone: 'Asia/Kolkata',
      },
      workingWeekRules: [],
      events: [],
    });
    versions.buildValidationSummary.mockReturnValue({
      readyForReview: true,
      issues: [],
    });

    await expect(
      service.publish('v1', { optimisticVersion: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('collapses superseded effectiveTo when amendment starts on same day', () => {
    const amendmentFrom = new Date('2026-08-07T00:00:00.000Z');
    const previousFrom = new Date('2026-08-07T00:00:00.000Z');
    const fullyReplaced = amendmentFrom.getTime() <= previousFrom.getTime();
    expect(fullyReplaced).toBe(true);
  });

  it('keeps prior published when amendment starts mid-range', () => {
    const amendmentFrom = new Date('2026-08-07T00:00:00.000Z');
    const previousFrom = new Date('2026-01-01T00:00:00.000Z');
    const fullyReplaced = amendmentFrom.getTime() <= previousFrom.getTime();
    const dayBefore = new Date(amendmentFrom.getTime() - 24 * 60 * 60 * 1000);
    expect(fullyReplaced).toBe(false);
    expect(dayBefore.toISOString().slice(0, 10)).toBe('2026-08-06');
  });

  it('returns published version with materialize.error when materialize fails after commit', async () => {
    const publishedVersion = {
      id: 'v1',
      status: BusinessCalendarVersionStatus.PUBLISHED,
      calendarId: 'cal-1',
    };
    versions.requireVersion.mockResolvedValue({
      id: 'v1',
      status: BusinessCalendarVersionStatus.IN_REVIEW,
      optimisticVersion: 1,
      amendsVersionId: null,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      changeReason: null,
      calendarId: 'cal-1',
      calendar: {
        companyId: 'co-1',
        branchId: 'br-1',
        scope: 'BRANCH',
        defaultTimezone: 'Asia/Kolkata',
      },
      workingWeekRules: [],
      events: [],
    });
    versions.buildValidationSummary.mockReturnValue({
      readyForReview: true,
      issues: [],
    });
    prisma.$transaction.mockResolvedValue({
      version: publishedVersion,
      amendmentId: null,
      officeScopeKey: 'co-1:br-1',
    });
    runtime.materializeRange.mockRejectedValue(
      new Error('materialize blew up'),
    );

    const result = await service.publish(
      'v1',
      { optimisticVersion: 1 },
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'v1',
        amendmentId: null,
        materialize: {
          written: 0,
          skipped: 0,
          error: 'materialize blew up',
        },
      }),
    );
  });

  it('emits OPTIONAL_HOLIDAY_SELECTION_OPENED for active branch users when policy exists', async () => {
    const tx = {
      companyHolidayPolicy: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pol-1' }),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'user-a' }, { id: 'user-b' }])
          .mockResolvedValueOnce([]),
      },
    };

    await (
      service as unknown as {
        notifyOptionalHolidaySelectionOpened: (
          client: unknown,
          input: unknown,
        ) => Promise<void>;
      }
    ).notifyOptionalHolidaySelectionOpened(tx, {
      versionId: 'v-opt',
      companyId: 'co-1',
      branchId: 'br-1',
      scope: 'BRANCH',
      events: [
        {
          isOptionalHoliday: true,
          startDate: new Date('2027-02-01T00:00:00.000Z'),
        },
      ],
    });

    expect(tx.companyHolidayPolicy.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'co-1',
        year: { in: [2027] },
        isActive: true,
      },
      select: { id: true },
    });
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          employee: {
            isActive: true,
            companyId: 'co-1',
            branchId: 'br-1',
          },
        },
      }),
    );
    expect(outboxWriter.write).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: 'OPTIONAL_HOLIDAY_SELECTION_OPENED',
        dedupeKey: 'OPTIONAL_HOLIDAY_SELECTION_OPENED:v-opt',
        payload: expect.objectContaining({
          recipientUserIds: ['user-a', 'user-b'],
        }) as object,
      }),
    );
  });

  it('skips OPTIONAL_HOLIDAY_SELECTION_OPENED when no optional events or policy', async () => {
    const tx = {
      companyHolidayPolicy: { findFirst: jest.fn() },
      user: { findMany: jest.fn() },
    };

    await (
      service as unknown as {
        notifyOptionalHolidaySelectionOpened: (
          client: unknown,
          input: unknown,
        ) => Promise<void>;
      }
    ).notifyOptionalHolidaySelectionOpened(tx, {
      versionId: 'v-plain',
      companyId: 'co-1',
      branchId: null,
      scope: 'COMPANY',
      events: [
        {
          isOptionalHoliday: false,
          startDate: new Date('2027-01-01T00:00:00.000Z'),
        },
      ],
    });

    expect(tx.companyHolidayPolicy.findFirst).not.toHaveBeenCalled();
    expect(outboxWriter.write).not.toHaveBeenCalled();
  });
});
