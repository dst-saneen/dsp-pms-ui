import { OutboxEventStatus, Prisma } from '@prisma/client';

import { OutboxWriterService } from './outbox-writer.service';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('OutboxWriterService', () => {
  const service = new OutboxWriterService();

  it('sanitizes unsafe payload keys', () => {
    const safe = service.sanitizePayload({
      leaveRequestId: 'lr-1',
      reason: 'medical leave details',
      remarks: 'private note',
      recipientUserIds: ['u-1', 'u-2'],
      approvedMinutes: 60,
    });

    expect(safe).toEqual({
      leaveRequestId: 'lr-1',
      recipientUserIds: ['u-1', 'u-2'],
      approvedMinutes: 60,
    });
    expect(safe).not.toHaveProperty('reason');
    expect(safe).not.toHaveProperty('remarks');
  });

  it('is idempotent on duplicate dedupe keys', async () => {
    const tx = {
      outboxEvent: {
        create: jest.fn().mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-1' }),
      },
    };

    const result = await service.write(tx as never, {
      aggregateType: 'LeaveRequest',
      aggregateId: 'lr-1',
      eventType: 'LEAVE_REQUEST_APPROVED',
      payload: { leaveRequestId: 'lr-1', employeeId: 'emp-1' },
      dedupeKey: 'leave:lr-1:approved',
      companyId: 'co-1',
    });

    expect(result).toEqual({ id: 'existing-1', created: false });
    expect(tx.outboxEvent.findUnique).toHaveBeenCalled();
  });

  it('creates pending outbox rows', async () => {
    const tx = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({
          id: 'ob-1',
          status: OutboxEventStatus.PENDING,
        }),
      },
    };

    const result = await service.write(tx as never, {
      aggregateType: 'ShiftRoster',
      aggregateId: 'r-1',
      eventType: 'SHIFT_ROSTER_PUBLISHED',
      payload: { rosterId: 'r-1', branchId: 'br-1', reason: 'secret' },
      dedupeKey: 'shift-roster:r-1:published:v1',
      companyId: 'co-1',
      branchId: 'br-1',
    });

    expect(result.created).toBe(true);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: { rosterId: 'r-1', branchId: 'br-1' },
          status: OutboxEventStatus.PENDING,
        }),
      }),
    );
  });
});
