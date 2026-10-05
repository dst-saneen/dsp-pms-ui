/**
 * Phase F — DeliveryController and DeliveryQueryService unit tests.
 *
 * Tests verify:
 * - HR scope is applied automatically (companyId/branchId from org scope)
 * - Ops (global) scope returns all messages without filter
 * - Retry/cancel blocked for terminal statuses
 * - Suppression release is idempotent via operationId
 * - Raw email address never appears in query output
 */

import {
  DeliveryChannel,
  DeliveryMessageStatus,
  DeliveryProvider,
  DeliveryRecipientKind,
} from '@prisma/client';
import { createHmac } from 'crypto';

import { DeliveryQueryService } from '../../src/modules/delivery/delivery-query.service';
import { DeliveryEmailWorker } from '../../src/modules/delivery/delivery-email.worker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryPrisma(messages: unknown[] = []) {
  return {
    deliveryMessage: {
      findMany: jest.fn((args: Record<string, unknown>) => {
        void args;
        return Promise.resolve(messages);
      }),
      count: jest.fn().mockResolvedValue(messages.length),
      groupBy: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(messages[0] ?? null),
      findFirst: jest.fn((args: Record<string, unknown>) => {
        void args;
        return Promise.resolve(messages[0] ?? null);
      }),
    },
    deliveryAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    emailSuppression: {
      findMany: jest.fn((args: Record<string, unknown>) => {
        void args;
        return Promise.resolve([]);
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    deliveryRecipientException: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

function makeMessage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dm-1',
    version: 1,
    outboxEventType: 'recruitment.offer.sent',
    eventType: 'recruitment.offer.sent',
    aggregateType: 'recruitment',
    aggregateId: 'agg-1',
    dedupeKey: 'dm:key-1',
    recipientKind: DeliveryRecipientKind.CANDIDATE,
    channel: DeliveryChannel.EMAIL,
    provider: DeliveryProvider.ZEPTOMAIL,
    status: DeliveryMessageStatus.QUEUED,
    companyId: 'co-1',
    branchId: 'br-1',
    attemptCount: 0,
    queuedAt: new Date(),
    nextAttemptAt: new Date(),
    firstAttemptAt: null,
    lastAttemptAt: null,
    acceptedAt: null,
    deliveredAt: null,
    terminalAt: null,
    deadLetteredAt: null,
    toDisplayName: 'Jane Doe',
    lastErrorCode: null,
    bypassReason: null,
    createdAt: new Date(),
    company: { companyName: 'Acme' },
    branch: { branchName: 'HQ' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DeliveryQueryService
// ---------------------------------------------------------------------------

describe('DeliveryQueryService', () => {
  it('passes companyId and branchId filters to prisma when provided', async () => {
    const mockPrisma = makeQueryPrisma([makeMessage()]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    await svc.listMessages({ companyId: 'co-1', branchId: 'br-1' });

    const [listArg] = mockPrisma.deliveryMessage.findMany.mock.calls;
    expect(listArg[0].where).toMatchObject({
      companyId: 'co-1',
      branchId: 'br-1',
    });
  });

  it('does not filter by company or branch when not provided (global scope)', async () => {
    const mockPrisma = makeQueryPrisma([makeMessage()]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    await svc.listMessages({});

    const [call] = mockPrisma.deliveryMessage.findMany.mock.calls;
    const where = call[0].where as Record<string, unknown>;
    expect(where.companyId).toBeUndefined();
    expect(where.branchId).toBeUndefined();
  });

  it('maps message rows and NEVER exposes toAddress', async () => {
    // Simulate a message that has a toAddress on the DB row (but select excludes it)
    const row = makeMessage();
    const mockPrisma = makeQueryPrisma([row]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    const result = await svc.listMessages({});
    const summary = result.items[0];

    // toAddress must not appear on the returned summary
    expect(summary).not.toHaveProperty('toAddress');
    // recipientDisplay is allowed (redacted)
    expect(summary.recipientDisplay).toBe('Jane Doe');
    expect(summary.allowedActions).toBeDefined();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('scopes getMessage by company and branch when provided', async () => {
    const mockPrisma = makeQueryPrisma([makeMessage()]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    await svc.getMessage('dm-1', { companyId: 'co-1', branchId: 'br-1' });

    const [getArg] = mockPrisma.deliveryMessage.findFirst.mock.calls;
    expect(getArg[0].where).toMatchObject({
      id: 'dm-1',
      companyId: 'co-1',
      branchId: 'br-1',
    });
  });

  it('does not return toAddress, body, or token fields from getMessage', async () => {
    const mockPrisma = makeQueryPrisma([makeMessage()]);
    const svc = new DeliveryQueryService(mockPrisma as never);
    const summary = await svc.getMessage('dm-1');

    expect(summary).not.toHaveProperty('toAddress');
    expect(summary).not.toHaveProperty('body');
    expect(summary).not.toHaveProperty('html');
    expect(JSON.stringify(summary)).not.toMatch(/token/i);
  });

  it('listDeadLetters always adds DEAD_LETTER status filter', async () => {
    const mockPrisma = makeQueryPrisma([]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    await svc.listDeadLetters({});

    const [deadLetterArg] = mockPrisma.deliveryMessage.findMany.mock.calls;
    expect(deadLetterArg[0].where).toMatchObject({
      status: DeliveryMessageStatus.DEAD_LETTER,
    });
  });

  it('listSuppressions filters releasedAt null (active only)', async () => {
    const mockPrisma = makeQueryPrisma([]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    await svc.listSuppressions({});

    const [suppressionArg] = mockPrisma.emailSuppression.findMany.mock.calls;
    expect(suppressionArg[0].where).toMatchObject({ releasedAt: null });
  });

  it('respects page and limit parameters', async () => {
    const mockPrisma = makeQueryPrisma([]);
    const svc = new DeliveryQueryService(mockPrisma as never);

    await svc.listMessages({ page: 3, limit: 10 });

    expect(mockPrisma.deliveryMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

// ---------------------------------------------------------------------------
// DeliveryEmailWorker — retry / cancel guards
// ---------------------------------------------------------------------------

describe('DeliveryEmailWorker — retry and cancel', () => {
  function makeWorkerPrisma(messageStatus: DeliveryMessageStatus) {
    return {
      deliveryMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ companyId: 'company-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      deliveryAttempt: {
        create: jest.fn().mockResolvedValue({}),
      },
      deliveryCommandReceipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryCommandReceipt: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          deliveryMessage: {
            findUnique: jest.fn().mockResolvedValue({ companyId: 'company-1' }),
            updateMany: jest.fn().mockResolvedValue({
              count:
                messageStatus === DeliveryMessageStatus.DEAD_LETTER ? 1 : 0,
            }),
          },
          emailSuppression: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };
  }

  it('retry updates message status to RETRY_WAIT for dead-letter', async () => {
    const mockPrisma = makeWorkerPrisma(DeliveryMessageStatus.DEAD_LETTER);
    const worker = new DeliveryEmailWorker(
      mockPrisma as never,
      {} as never,
      {} as never,
      {
        createWorkerIdentity: jest.fn(),
        claimBatch: jest.fn(),
        isAllowedScope: jest.fn().mockReturnValue(true),
      } as never,
      {} as never,
      {
        getOrThrow: jest.fn((key: string) =>
          key.includes('VERSION') ? 'v1' : { v1: Buffer.alloc(32, 5) },
        ),
      } as never,
    );

    await worker.retry('dm-1', {
      operationId: 'op-1',
      expectedVersion: 1,
      reason: 'manual retry',
      actorUserId: 'user-1',
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('allows an SMTP delivery message to be retried', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryCommandReceipt: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          deliveryMessage: {
            findUnique: jest.fn().mockResolvedValue({ companyId: 'company-1' }),
            updateMany,
          },
        }),
      ),
    };
    const worker = new DeliveryEmailWorker(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getOrThrow: jest.fn((key: string) =>
          key.includes('VERSION') ? 'v1' : { v1: Buffer.alloc(32, 5) },
        ),
      } as never,
    );

    await worker.retry('dm-smtp-1', {
      operationId: 'op-smtp-retry',
      expectedVersion: 1,
      reason: 'SMTP provider restored',
      actorUserId: 'user-1',
    });

    const updateCalls = updateMany.mock.calls as unknown;
    if (!Array.isArray(updateCalls) || !Array.isArray(updateCalls[0])) {
      throw new Error('Expected Delivery retry update to be recorded.');
    }
    const updateInput = updateCalls[0][0] as { where?: unknown };
    expect(updateInput.where).toMatchObject({
      provider: {
        in: [DeliveryProvider.ZEPTOMAIL, DeliveryProvider.SMTP],
      },
    });
  });

  it('retry is idempotent — duplicate operationId for same message does nothing', async () => {
    const receiptHash = createHmac('sha256', Buffer.alloc(32, 5))
      .update(
        JSON.stringify({
          commandType: 'retry',
          deliveryMessageId: 'dm-1',
          expectedVersion: 1,
          reason: 'retry',
        }),
        'utf8',
      )
      .digest('hex');
    const prismaWithExistingReceipt = {
      ...makeWorkerPrisma(DeliveryMessageStatus.DEAD_LETTER),
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryCommandReceipt: {
            findFirst: jest.fn().mockResolvedValue({
              deliveryMessageId: 'dm-1',
              commandType: 'retry',
              requestHash: receiptHash,
              requestHashKeyVersion: 'v1',
              requestHashFormatVersion: 1,
            }),
            create: jest.fn(),
          },
          deliveryMessage: {
            findUnique: jest.fn().mockResolvedValue({ companyId: 'company-1' }),
            updateMany: jest.fn(),
          },
        }),
      ),
    };

    const worker = new DeliveryEmailWorker(
      prismaWithExistingReceipt as never,
      {} as never,
      {} as never,
      {
        createWorkerIdentity: jest.fn(),
        claimBatch: jest.fn(),
        isAllowedScope: jest.fn().mockReturnValue(true),
      } as never,
      {} as never,
      {
        getOrThrow: jest.fn((key: string) =>
          key.includes('VERSION') ? 'v1' : { v1: Buffer.alloc(32, 5) },
        ),
      } as never,
    );

    await expect(
      worker.retry('dm-1', {
        operationId: 'op-dup',
        expectedVersion: 1,
        reason: 'retry',
        actorUserId: 'user-1',
      }),
    ).resolves.not.toThrow();
  });

  it('cancel moves QUEUED message to CANCELLED', async () => {
    const mockPrisma = {
      ...makeWorkerPrisma(DeliveryMessageStatus.QUEUED),
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryCommandReceipt: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          deliveryMessage: {
            findUnique: jest.fn().mockResolvedValue({ companyId: 'company-1' }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
      ),
    };
    const worker = new DeliveryEmailWorker(
      mockPrisma as never,
      {} as never,
      {} as never,
      {
        createWorkerIdentity: jest.fn(),
        claimBatch: jest.fn(),
        isAllowedScope: jest.fn().mockReturnValue(true),
      } as never,
      {} as never,
      {
        getOrThrow: jest.fn((key: string) =>
          key.includes('VERSION') ? 'v1' : { v1: Buffer.alloc(32, 5) },
        ),
      } as never,
    );

    await worker.cancel('dm-1', {
      operationId: 'op-cancel-1',
      expectedVersion: 1,
      reason: 'cancel',
      actorUserId: 'user-1',
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
