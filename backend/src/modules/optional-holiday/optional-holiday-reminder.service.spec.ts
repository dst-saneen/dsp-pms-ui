import { UserStatus } from '@prisma/client';

import { LeaveRequestStatus } from '../employee-leave/constants';
import { WorkforceNotificationEventCode } from '../notification/notification-event.catalog';
import { OptionalHolidayReminderService } from './optional-holiday-reminder.service';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('OptionalHolidayReminderService', () => {
  const prisma = {
    leaveRequest: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const outboxWriter = {
    write: jest.fn(),
  };

  const service = new OptionalHolidayReminderService(
    prisma as never,
    outboxWriter as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.leaveRequest.findMany.mockReset();
    outboxWriter.write.mockReset();
    prisma.$transaction.mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
  });

  it('queues one OPTIONAL_HOLIDAY_TOMORROW when leave date is tomorrow in branch TZ', async () => {
    // 2027-03-14 18:30 UTC = 2027-03-15 00:00 Asia/Kolkata → tomorrow is 2027-03-16
    const now = new Date('2027-03-14T18:30:00.000Z');
    prisma.leaveRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'lr-1',
          companyId: 'co-1',
          employeeId: 'emp-1',
          fromDate: new Date('2027-03-16T00:00:00.000Z'),
          employee: {
            id: 'emp-1',
            branchId: 'br-1',
            branch: { timezone: 'Asia/Kolkata' },
            user: { id: 'user-1', status: UserStatus.ACTIVE },
          },
        },
        {
          id: 'lr-skip',
          companyId: 'co-1',
          employeeId: 'emp-2',
          fromDate: new Date('2027-03-17T00:00:00.000Z'),
          employee: {
            id: 'emp-2',
            branchId: 'br-1',
            branch: { timezone: 'Asia/Kolkata' },
            user: { id: 'user-2', status: UserStatus.ACTIVE },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    outboxWriter.write.mockResolvedValue({ id: 'ob-1', created: true });

    const result = await service.runDueReminders(now);

    expect(result).toEqual({ scanned: 2, queued: 1 });
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          optionalHolidayEventId: { not: null },
          status: LeaveRequestStatus.APPROVED,
          isActive: true,
        },
      }),
    );
    expect(outboxWriter.write).toHaveBeenCalledTimes(1);
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_TOMORROW,
        dedupeKey: `${WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_TOMORROW}:lr-1:2027-03-16:user-1`,
        payload: expect.objectContaining({
          leaveRequestId: 'lr-1',
          businessDate: '2027-03-16',
          recipientUserIds: ['user-1'],
        }),
      }),
    );
  });

  it('queues zero duplicates when outbox dedupe hits on re-run', async () => {
    const now = new Date('2027-03-14T18:30:00.000Z');
    prisma.leaveRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'lr-1',
          companyId: 'co-1',
          employeeId: 'emp-1',
          fromDate: new Date('2027-03-16T00:00:00.000Z'),
          employee: {
            id: 'emp-1',
            branchId: 'br-1',
            branch: { timezone: 'Asia/Kolkata' },
            user: { id: 'user-1', status: UserStatus.ACTIVE },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    outboxWriter.write.mockResolvedValue({ id: 'ob-1', created: false });

    const result = await service.runDueReminders(now);

    expect(result).toEqual({ scanned: 1, queued: 0 });
    expect(outboxWriter.write).toHaveBeenCalledTimes(1);
  });

  it('skips inactive users and invalid timezones', async () => {
    const now = new Date('2027-03-14T18:30:00.000Z');
    prisma.leaveRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'lr-1',
          companyId: 'co-1',
          employeeId: 'emp-1',
          fromDate: new Date('2027-03-16T00:00:00.000Z'),
          employee: {
            id: 'emp-1',
            branchId: 'br-1',
            branch: { timezone: 'Asia/Kolkata' },
            user: { id: 'user-1', status: UserStatus.DISABLED },
          },
        },
        {
          id: 'lr-2',
          companyId: 'co-1',
          employeeId: 'emp-2',
          fromDate: new Date('2027-03-16T00:00:00.000Z'),
          employee: {
            id: 'emp-2',
            branchId: 'br-2',
            branch: { timezone: 'Not/AZone' },
            user: { id: 'user-2', status: UserStatus.ACTIVE },
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.runDueReminders(now);

    expect(result).toEqual({ scanned: 2, queued: 0 });
    expect(outboxWriter.write).not.toHaveBeenCalled();
  });
});
