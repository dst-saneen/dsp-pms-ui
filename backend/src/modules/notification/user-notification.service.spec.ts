import { Prisma } from '@prisma/client';

import { UserNotificationService } from './user-notification.service';

describe('UserNotificationService', () => {
  it('creates notifications and returns existing on dedupe', async () => {
    const prisma = {
      userNotification: {
        create: jest
          .fn()
          .mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError('Unique', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          )
          .mockResolvedValueOnce({ id: 'n-2' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'n-1' }),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { findFirst: jest.fn() },
    };

    const service = new UserNotificationService(prisma as never);

    const duplicate = await service.create({
      userId: 'u-1',
      eventCode: 'LEAVE_REQUEST_APPROVED',
      dedupeKey: 'notification:leave:lr-1:user:u-1',
      entityType: 'LeaveRequest',
      entityId: 'lr-1',
    });
    expect(duplicate).toEqual({ id: 'n-1', created: false });

    const created = await service.create({
      userId: 'u-1',
      eventCode: 'LEAVE_REQUEST_APPROVED',
      dedupeKey: 'notification:leave:lr-2:user:u-1',
    });
    expect(created).toEqual({ id: 'n-2', created: true });
  });

  it('maps workspace DTOs without exposing sensitive fields', () => {
    const service = new UserNotificationService({} as never);
    const mapped = service.toWorkspaceDto([
      {
        title: 'Leave request approved',
        message: 'Your leave request was approved.',
        eventCode: 'LEAVE_REQUEST_APPROVED',
        createdAt: new Date('2026-08-05T10:00:00.000Z'),
        readAt: null,
      },
    ]);

    expect(mapped[0]).toEqual({
      title: 'Leave request approved',
      description: 'Your leave request was approved.',
      priority: 'NORMAL',
      time: '2026-08-05T10:00:00.000Z',
      read: false,
      href: '/my-workspace/leave',
    });
  });

  it('maps optional holiday notifications to /my-workspace', () => {
    const service = new UserNotificationService({} as never);
    const mapped = service.toWorkspaceDto([
      {
        title: 'Optional holiday dates available',
        message:
          'Optional holiday dates are available. Choose your dates in My Workspace.',
        eventCode: 'OPTIONAL_HOLIDAY_SELECTION_OPENED',
        createdAt: new Date('2026-08-05T10:00:00.000Z'),
        readAt: null,
      },
      {
        title: 'Optional Holiday tomorrow',
        message:
          'You are on approved Optional Holiday tomorrow. No check-in is required.',
        eventCode: 'OPTIONAL_HOLIDAY_TOMORROW',
        createdAt: new Date('2026-08-05T10:00:00.000Z'),
        readAt: null,
      },
    ]);

    expect(mapped[0]?.href).toBe('/my-workspace');
    expect(mapped[1]?.href).toBe('/my-workspace');
    expect(mapped[1]?.priority).toBe('HIGH');
  });
});
