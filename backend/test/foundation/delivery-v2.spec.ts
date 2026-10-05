/**
 * Phase E — Delivery V2 unit tests.
 *
 * These tests use in-memory mocks (no real DB or network).
 * The integration tests that require a real PostgreSQL DB are gated behind
 * DELIVERY_V2_TEST=1 and are kept in delivery-v2.integration.spec.ts.
 */

import {
  DeliveryChannel,
  DeliveryMessageStatus,
  DeliveryProvider,
  DeliveryRecipientKind,
  OutboxEventStatus,
} from '@prisma/client';

import { DeliveryFanoutService } from '../../src/modules/delivery/delivery-fanout.service';
import { DeliveryEmailWorker } from '../../src/modules/delivery/delivery-email.worker';
import { DeliveryInAppWorker } from '../../src/modules/delivery/delivery-inapp.worker';
import { DeliverySuppressionService } from '../../src/modules/delivery/delivery-suppression.service';

function firstCallArg(mockFn: {
  mock: { calls: unknown[][] };
}): Record<string, unknown> {
  const first = mockFn.mock.calls[0];
  const arg = first?.[0];
  if (arg === null || typeof arg !== 'object') {
    throw new Error('expected mock to have been called with an object');
  }
  return arg as Record<string, unknown>;
}

function allCallArgs(mockFn: {
  mock: { calls: unknown[][] };
}): Record<string, unknown>[] {
  return mockFn.mock.calls.map((call) => {
    const arg = call[0];
    if (arg === null || typeof arg !== 'object') {
      throw new Error('expected mock to have been called with an object');
    }
    return arg as Record<string, unknown>;
  });
}

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makeOutboxEvent(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'evt-1',
    companyGroupId: 'cg-1',
    companyId: 'co-1',
    branchId: 'br-1',
    aggregateType: 'recruitment',
    aggregateId: 'app-1',
    eventType: 'recruitment.interview.scheduled',
    dedupeKey: 'recruit:interview-scheduled:sess-1',
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    availableAt: new Date(),
    lockedAt: null,
    processedAt: null,
    lastErrorCode: null,
    payload: {
      candidateId: 'cand-1',
      candidateEmail: 'jane@example.test',
      candidateName: 'Jane Doe',
      interviewSessionId: 'sess-1',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeliveryMessage(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'dm-1',
    companyGroupId: 'cg-1',
    companyId: 'co-1',
    branchId: 'br-1',
    outboxEventId: 'evt-1',
    outboxEventType: 'recruitment.interview.scheduled',
    aggregateType: 'JobApplication',
    aggregateId: 'aggregate-1',
    eventType: 'recruitment.interview.scheduled',
    dedupeKey: 'dm:recruit:interview-scheduled:sess-1:CANDIDATE:cand-1:EMAIL',
    recipientKind: DeliveryRecipientKind.CANDIDATE,
    recipientId: 'cand-1',
    channel: DeliveryChannel.EMAIL,
    provider: DeliveryProvider.ZEPTOMAIL,
    status: DeliveryMessageStatus.QUEUED,
    attemptCount: 0,
    nextAttemptAt: new Date(Date.now() - 1_000),
    firstAttemptAt: null,
    lastAttemptAt: null,
    deliveredAt: null,
    toAddress: 'jane@example.test',
    toDisplayName: 'Jane Doe',
    subject: 'Your interview has been scheduled',
    clientReference: null,
    providerMessageId: null,
    lastErrorCode: null,
    bypassReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DeliveryFanoutService
// ---------------------------------------------------------------------------

describe('DeliveryFanoutService', () => {
  let mockPrisma: {
    deliveryMessage: {
      upsert: jest.Mock;
    };
  };
  let mockResolver: { resolve: jest.Mock };
  let mockExceptions: { record: jest.Mock };
  let mockMail: { getDeliveryProvider: jest.Mock };
  let service: DeliveryFanoutService;

  beforeEach(() => {
    mockPrisma = {
      deliveryMessage: {
        upsert: jest.fn((args: Record<string, unknown>) => {
          void args;
          return Promise.resolve({});
        }),
      },
    };
    mockResolver = {
      resolve: jest.fn().mockResolvedValue({
        recipients: [
          {
            kind: DeliveryRecipientKind.CANDIDATE,
            recipientId: 'cand-1',
            channels: [DeliveryChannel.EMAIL],
            toAddress: 'jane@example.test',
            displayName: 'Jane Doe',
            subject: 'Your interview has been scheduled',
          },
        ],
        exceptions: [],
      }),
    };
    mockExceptions = { record: jest.fn().mockResolvedValue(undefined) };
    const mockContent = {
      renderSnapshot: jest.fn().mockResolvedValue({
        templateKey: 'delivery.recruitment.interview.scheduled',
        templateVersion: '1',
        subject: 'Your interview has been scheduled',
        bodyText: 'text',
        bodyHtml: '<p>html</p>',
      }),
    };
    const mockCrypto = {
      isReady: jest.fn().mockReturnValue(true),
      sealAddress: jest.fn().mockReturnValue({
        ciphertext: 'addr-ct',
        nonce: 'addr-n',
        authTag: 'addr-t',
        keyVersion: 'v1',
        addressHmac: 'hmac',
        hmacKeyVersion: 'v1',
      }),
      sealEmailContent: jest.fn().mockReturnValue({
        subjectCiphertext: 'sub-ct',
        bodyTextCiphertext: 'text-ct',
        bodyHtmlCiphertext: 'html-ct',
        contentNonce: 'n',
        contentAuthTag: 't',
        contentKeyVersion: 'v1',
      }),
    };
    mockMail = {
      getDeliveryProvider: jest
        .fn()
        .mockReturnValue(DeliveryProvider.ZEPTOMAIL),
    };
    service = new DeliveryFanoutService(
      mockPrisma as never,
      mockResolver as never,
      mockExceptions as never,
      mockContent as never,
      mockCrypto as never,
      mockMail as never,
    );
  });

  it('seals immutable email content at fan-out', async () => {
    const event = makeOutboxEvent();
    await service.fanOut(event as never);

    const create = firstCallArg(mockPrisma.deliveryMessage.upsert)
      .create as Record<string, unknown>;
    expect(create).toMatchObject({
      status: DeliveryMessageStatus.QUEUED,
      recipientKind: DeliveryRecipientKind.CANDIDATE,
      channel: DeliveryChannel.EMAIL,
      toAddress: null,
      subjectCiphertext: 'sub-ct',
      bodyTextCiphertext: 'text-ct',
      bodyHtmlCiphertext: 'html-ct',
      recipientAddressCiphertext: 'addr-ct',
      recipientAddressHmac: 'hmac',
      templateKey: 'delivery.recruitment.interview.scheduled',
      templateVersion: '1',
      provider: DeliveryProvider.ZEPTOMAIL,
    });
    expect(typeof create.clientReference).toBe('string');
  });

  it('does not copy an email address into plaintext display-name fields', async () => {
    mockResolver.resolve.mockResolvedValue({
      recipients: [
        {
          kind: DeliveryRecipientKind.USER,
          recipientId: 'user-1',
          recipientUserId: 'user-1',
          channels: [DeliveryChannel.EMAIL],
          toAddress: 'employee@example.test',
          displayName: undefined,
          subject: 'Your leave request was approved',
        },
      ],
      exceptions: [],
    });

    await service.fanOut(
      makeOutboxEvent({
        aggregateType: 'LeaveRequest',
        aggregateId: 'leave-1',
        eventType: 'LEAVE_REQUEST_APPROVED',
      }) as never,
    );

    const create = firstCallArg(mockPrisma.deliveryMessage.upsert)
      .create as Record<string, unknown>;
    expect(create.toAddress).toBeNull();
    expect(create.subject).toBeNull();
    expect(create.toDisplayName).toBeUndefined();
  });

  it('stores SMTP as the selected provider for newly queued email', async () => {
    mockMail.getDeliveryProvider.mockReturnValue(DeliveryProvider.SMTP);

    await service.fanOut(makeOutboxEvent() as never);

    const create = firstCallArg(mockPrisma.deliveryMessage.upsert)
      .create as Record<string, unknown>;
    expect(create.provider).toBe(DeliveryProvider.SMTP);
  });

  it('uses stable per-event, recipient, and channel keys across workforce retries', async () => {
    mockResolver.resolve.mockResolvedValue({
      recipients: [
        {
          kind: DeliveryRecipientKind.USER,
          recipientId: 'user-1',
          recipientUserId: 'user-1',
          channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
          toAddress: 'employee@example.test',
          displayName: 'Employee',
          subject: 'Your leave request was approved',
        },
      ],
      exceptions: [],
    });
    const event = makeOutboxEvent({
      aggregateType: 'LeaveRequest',
      aggregateId: 'leave-1',
      eventType: 'LEAVE_REQUEST_APPROVED',
      dedupeKey: 'leave:leave-1:approved:v1',
    });
    await service.fanOut(event as never);
    await service.fanOut(event as never);

    const calls = allCallArgs(mockPrisma.deliveryMessage.upsert) as Array<{
      where: { dedupeKey: string };
      update: unknown;
    }>;
    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.where.dedupeKey)).toEqual([
      'dm:leave:leave-1:approved:v1:USER:user-1:EMAIL',
      'dm:leave:leave-1:approved:v1:USER:user-1:IN_APP',
      'dm:leave:leave-1:approved:v1:USER:user-1:EMAIL',
      'dm:leave:leave-1:approved:v1:USER:user-1:IN_APP',
    ]);
    expect(calls.every((call) => JSON.stringify(call.update) === '{}')).toBe(
      true,
    );
  });

  it('records redacted exceptions and does not create messages when none resolve', async () => {
    mockResolver.resolve.mockResolvedValue({
      recipients: [],
      exceptions: [{ reasonCode: 'NO_SAFE_EMAIL' }],
    });
    const event = makeOutboxEvent();
    await service.fanOut(event as never);

    expect(mockExceptions.record).toHaveBeenCalledWith(event, [
      { reasonCode: 'NO_SAFE_EMAIL' },
    ]);
    expect(mockPrisma.deliveryMessage['upsert']).not.toHaveBeenCalled();
  });

  it('does not trust payload recipientUserIds; resolver owns recipients', async () => {
    mockResolver.resolve.mockResolvedValue({
      recipients: [],
      exceptions: [{ reasonCode: 'UNSUPPORTED_EVENT' }],
    });
    const event = makeOutboxEvent({
      eventType: 'leave.approved',
      payload: { recipientUserIds: ['user-1', 'user-2'] },
    });
    await service.fanOut(event as never);

    expect(mockPrisma.deliveryMessage['upsert']).not.toHaveBeenCalled();
    expect(mockExceptions.record).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DeliveryEmailWorker
// ---------------------------------------------------------------------------

describe('DeliveryEmailWorker', () => {
  let mockPrisma: {
    deliveryMessage: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    deliveryAttempt: { create: jest.Mock };
    deliveryCommandReceipt: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mockMail: Record<string, jest.Mock>;
  let mockSuppression: Record<string, jest.Mock>;
  let mockClaim: Record<string, jest.Mock>;
  let worker: DeliveryEmailWorker;

  beforeEach(() => {
    const message = makeDeliveryMessage();

    mockPrisma = {
      deliveryMessage: {
        findMany: jest.fn().mockResolvedValue([message]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn((args: Record<string, unknown>) => {
          void args;
          return Promise.resolve({});
        }),
      },
      deliveryAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'da-1' }),
      },
      deliveryCommandReceipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryAttempt: {
            create: jest.fn().mockResolvedValue({ id: 'da-1' }),
          },
          deliveryMessage: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };

    mockMail = {
      getDeliveryProvider: jest
        .fn()
        .mockReturnValue(DeliveryProvider.ZEPTOMAIL),
      sendDeliveryMessage: jest.fn().mockResolvedValue({
        disposition: 'ACCEPTED',
        provider: DeliveryProvider.ZEPTOMAIL,
        requestId: 'req-1',
        emailReference: 'msg-1',
      }),
    };

    mockSuppression = {
      isSuppressed: jest.fn().mockResolvedValue(false),
    };

    mockClaim = {
      createWorkerIdentity: jest.fn().mockReturnValue({
        workerId: 'delivery-email:test',
        workerCorrelationId: 'corr-1',
      }),
      claimBatch: jest.fn().mockResolvedValue(['dm-1']),
      isAllowedScope: jest.fn().mockResolvedValue(true),
    };

    worker = new DeliveryEmailWorker(
      mockPrisma as never,
      mockMail as never,
      mockSuppression as never,
      mockClaim as never,
      {} as never,
      {
        getOrThrow: jest.fn((key: string) =>
          key.includes('VERSION') ? 'v1' : { v1: Buffer.alloc(32, 5) },
        ),
      } as never,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('claims then marks ACCEPTED with the provider result', async () => {
    const result = await worker.processBatch();

    expect(mockClaim.claimBatch).toHaveBeenCalled();
    expect(mockMail.sendDeliveryMessage).toHaveBeenCalledWith(
      expect.objectContaining({ clientReference: 'dm-1' }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result.accepted).toBe(1);
    expect(result.processed).toBe(1);
  });

  it('sets ACCEPTED with acceptedAt and never deliveredAt on provider acceptance', async () => {
    const txUpdate = jest.fn((args: Record<string, unknown>) => {
      void args;
      return Promise.resolve({});
    });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryAttempt: {
            create: jest.fn().mockResolvedValue({ id: 'da-1' }),
          },
          deliveryMessage: { update: txUpdate },
        }),
    );

    await worker.processBatch();

    const accepted = firstCallArg(txUpdate).data as Record<string, unknown>;
    expect(accepted).toMatchObject({
      status: DeliveryMessageStatus.ACCEPTED,
    });
    expect(accepted.acceptedAt).toBeInstanceOf(Date);
    expect(accepted.deliveredAt).toBeUndefined();
  });

  it('records SMTP as the provider that accepted the message', async () => {
    const attemptCreate = jest.fn().mockResolvedValue({ id: 'da-1' });
    const messageUpdate = jest.fn().mockResolvedValue({});
    mockMail.getDeliveryProvider.mockReturnValue(DeliveryProvider.SMTP);
    mockMail.sendDeliveryMessage.mockResolvedValue({
      disposition: 'ACCEPTED',
      provider: DeliveryProvider.SMTP,
      requestId: null,
      emailReference: '<smtp-message-1@example.test>',
    });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryAttempt: { create: attemptCreate },
          deliveryMessage: { update: messageUpdate },
        }),
    );

    await worker.processBatch();

    expect(firstCallArg(attemptCreate).data).toMatchObject({
      provider: DeliveryProvider.SMTP,
      providerRequestId: null,
      providerEmailReference: '<smtp-message-1@example.test>',
    });
    expect(firstCallArg(messageUpdate).data).toMatchObject({
      provider: DeliveryProvider.SMTP,
      providerMessageId: '<smtp-message-1@example.test>',
    });
  });

  it('marks a development bypass as BYPASSED without an external provider', async () => {
    mockMail.sendDeliveryMessage.mockResolvedValue({
      disposition: 'BYPASSED',
      provider: DeliveryProvider.NONE,
      requestId: null,
      emailReference: null,
    });

    const result = await worker.processBatch();

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(firstCallArg(mockPrisma.deliveryMessage.update).data).toMatchObject({
      provider: DeliveryProvider.NONE,
      status: DeliveryMessageStatus.BYPASSED,
      bypassReason: 'EMAIL_DEV_BYPASS',
    });
    expect(result).toMatchObject({ accepted: 0, bypassed: 1 });
  });

  it('bypasses suppressed address and marks BYPASSED', async () => {
    mockSuppression.isSuppressed.mockResolvedValue(true);

    const result = await worker.processBatch();

    expect(mockMail.sendDeliveryMessage).not.toHaveBeenCalled();
    expect(firstCallArg(mockPrisma.deliveryMessage.update).data).toMatchObject({
      status: DeliveryMessageStatus.BYPASSED,
      bypassReason: 'EMAIL_SUPPRESSED',
    });
    expect(result.bypassed).toBe(1);
  });

  it('retries transient failure with RETRY_WAIT backoff', async () => {
    mockMail.sendDeliveryMessage.mockRejectedValue(
      Object.assign(new Error('Connection refused'), {
        errorClass: 'TRANSIENT',
        isPermanent: false,
        providerCode: 'ZEPTOMAIL_NETWORK_ERROR',
      }),
    );

    const result = await worker.processBatch();

    expect(result.failed).toBe(1);
    expect(result.deadLettered).toBe(0);
  });

  it('records SMTP retry evidence with its provider status code', async () => {
    const attemptCreate = jest.fn().mockResolvedValue({ id: 'da-1' });
    const messageUpdate = jest.fn().mockResolvedValue({});
    mockMail.getDeliveryProvider.mockReturnValue(DeliveryProvider.SMTP);
    mockMail.sendDeliveryMessage.mockRejectedValue(
      Object.assign(new Error('Service temporarily unavailable'), {
        errorClass: 'TRANSIENT',
        providerCode: 'SMTP_421',
        providerStatusCode: 421,
      }),
    );
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryAttempt: { create: attemptCreate },
          deliveryMessage: { update: messageUpdate },
        }),
    );

    await worker.processBatch();

    expect(firstCallArg(attemptCreate).data).toMatchObject({
      provider: DeliveryProvider.SMTP,
      providerStatusCode: 421,
      errorCode: 'SMTP_421',
      outcome: 'TRANSIENT_FAILURE',
    });
    expect(firstCallArg(messageUpdate).data).toMatchObject({
      provider: DeliveryProvider.SMTP,
      status: DeliveryMessageStatus.RETRY_WAIT,
    });
  });

  it('moves ambiguous post-transmit timeout to RECONCILING without resend', async () => {
    mockMail.sendDeliveryMessage.mockRejectedValue(
      Object.assign(new Error('Timeout'), {
        errorClass: 'AMBIGUOUS',
        isAmbiguous: true,
        isPermanent: false,
        providerCode: 'ZEPTOMAIL_TIMEOUT_AMBIGUOUS',
      }),
    );
    const txUpdate = jest.fn((args: Record<string, unknown>) => {
      void args;
      return Promise.resolve({});
    });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryAttempt: {
            create: jest.fn().mockResolvedValue({ id: 'da-1' }),
          },
          deliveryMessage: { update: txUpdate },
        }),
    );

    const result = await worker.processBatch();

    const reconciling = firstCallArg(txUpdate).data as Record<string, unknown>;
    expect(reconciling).toMatchObject({
      status: DeliveryMessageStatus.RECONCILING,
      lastErrorClass: 'AMBIGUOUS',
      lastErrorCode: 'ZEPTOMAIL_TIMEOUT_AMBIGUOUS',
    });
    expect(reconciling.nextAttemptAt).toBeUndefined();
    expect(result.failed).toBe(1);
    expect(result.deadLettered).toBe(0);
  });

  it('dead-letters after max attempts exhausted', async () => {
    const exhausted = makeDeliveryMessage({ attemptCount: 6 });
    mockPrisma.deliveryMessage.findMany.mockResolvedValue([exhausted]);
    mockMail.sendDeliveryMessage.mockRejectedValue(
      Object.assign(new Error('Timeout'), {
        errorClass: 'TRANSIENT',
        isPermanent: false,
      }),
    );

    const result = await worker.processBatch();

    expect(result.deadLettered).toBe(1);
  });

  it('dead-letters immediately on permanent rejection', async () => {
    mockMail.sendDeliveryMessage.mockRejectedValue(
      Object.assign(new Error('Invalid address'), {
        errorClass: 'PERMANENT',
        isPermanent: true,
        providerCode: 'ZEPTOMAIL_PERMANENT_ERROR',
      }),
    );

    const result = await worker.processBatch();

    expect(result.deadLettered).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DeliveryInAppWorker
// ---------------------------------------------------------------------------

describe('DeliveryInAppWorker', () => {
  let mockPrisma: {
    deliveryMessage: Record<string, jest.Mock>;
    deliveryAttempt: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let mockNotifications: Record<string, jest.Mock>;
  let mockClaim: Record<string, jest.Mock>;
  let worker: DeliveryInAppWorker;

  beforeEach(() => {
    const message = makeDeliveryMessage({
      channel: DeliveryChannel.IN_APP,
      provider: DeliveryProvider.INTERNAL,
      toAddress: null,
      subject: null,
      recipientUserId: 'user-1',
    });

    mockPrisma = {
      deliveryMessage: {
        findMany: jest.fn().mockResolvedValue([message]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      deliveryAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'da-1' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          deliveryAttempt: {
            create: jest.fn().mockResolvedValue({ id: 'da-1' }),
          },
          deliveryMessage: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };

    mockNotifications = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1', created: true }),
    };

    mockClaim = {
      createWorkerIdentity: jest.fn().mockReturnValue({
        workerId: 'delivery-inapp:test',
        workerCorrelationId: 'corr-2',
      }),
      claimBatch: jest.fn().mockResolvedValue(['dm-1']),
      isAllowedScope: jest.fn().mockResolvedValue(true),
    };

    worker = new DeliveryInAppWorker(
      mockPrisma as never,
      mockNotifications as never,
      mockClaim as never,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('writes notification with legacy-compatible dedupe key', async () => {
    const message = makeDeliveryMessage({
      channel: DeliveryChannel.IN_APP,
      provider: DeliveryProvider.INTERNAL,
      dedupeKey: 'dm:recruit:interview-scheduled:sess-1:HR:user-1:IN_APP',
      toAddress: null,
      subject: null,
      recipientUserId: 'user-1',
    });
    mockPrisma.deliveryMessage['findMany'].mockResolvedValue([message]);

    await worker.processBatch();

    expect(mockNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey:
          'notification:recruit:interview-scheduled:sess-1:user:user-1',
      }),
    );
  });

  it('writes notification and marks DELIVERED', async () => {
    const result = await worker.processBatch();

    expect(mockClaim.claimBatch).toHaveBeenCalled();
    expect(mockNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'JobApplication',
        entityId: 'aggregate-1',
      }),
    );
    expect(result.processed).toBe(1);
  });

  it('dead-letters after 2 failed in-app attempts (best-effort)', async () => {
    const message = makeDeliveryMessage({
      channel: DeliveryChannel.IN_APP,
      attemptCount: 1,
      recipientUserId: 'user-1',
    });
    mockPrisma.deliveryMessage['findMany'].mockResolvedValue([message]);
    mockNotifications.create.mockRejectedValue(new Error('DB error'));

    const result = await worker.processBatch();

    expect(result.deadLettered).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DeliverySuppressionService
// ---------------------------------------------------------------------------

describe('DeliverySuppressionService', () => {
  let mockPrisma: {
    emailSuppression: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    deliveryCommandReceipt: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: DeliverySuppressionService;
  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION') return 'v1';
      if (key === 'DELIVERY_ADDRESS_HMAC_KEYS')
        return { v1: Buffer.alloc(32, 7) };
      if (key === 'DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION') return 'v1';
      if (key === 'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS')
        return { v1: Buffer.alloc(32, 9) };
      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION') {
        return 'v1';
      }
      if (key === 'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS') {
        return { v1: Buffer.alloc(32, 9) };
      }
      return 'test-secret';
    }),
  };

  beforeEach(() => {
    mockPrisma = {
      emailSuppression: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'sup-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      deliveryCommandReceipt: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockPrisma),
      ),
    };

    service = new DeliverySuppressionService(
      mockConfig as never,
      mockPrisma as never,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('isSuppressed returns false when no row found', async () => {
    const result = await service.isSuppressed('user@test.com', 'company-1');
    expect(result).toBe(false);
  });

  it('isSuppressed returns true when an active suppression exists', async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue({
      id: 'sup-1',
    });
    const result = await service.isSuppressed('user@test.com', 'company-1');
    expect(result).toBe(true);
  });

  it('suppress creates a new suppression row', async () => {
    await service.suppress({
      address: 'bounced@test.com',
      companyId: 'company-1',
      reason: 'HARD_BOUNCE',
    });
    expect(mockPrisma.emailSuppression.create).toHaveBeenCalled();
  });

  it('suppress updates existing suppression (not create)', async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue({
      id: 'sup-existing',
    });
    await service.suppress({
      address: 'bounced@test.com',
      companyId: 'company-1',
      reason: 'COMPLAINT',
    });
    expect(mockPrisma.emailSuppression.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sup-existing' } }),
    );
    expect(mockPrisma.emailSuppression.create).not.toHaveBeenCalled();
  });

  it('normalises email address before hashing (case-insensitive)', () => {
    const h1 = service.hmac('User@EXAMPLE.COM');
    const h2 = service.hmac('user@example.com');
    expect(h1).toBe(h2);
  });

  it('release marks suppression as released (idempotent via operationId)', async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue({
      id: 'sup-1',
      companyId: 'company-1',
      releasedAt: null,
    });
    await service.release({
      suppressionId: 'sup-1',
      releasedBy: 'admin-user',
      operationId: 'op-release-1',
      expectedVersion: 1,
      reason: 'Reviewed',
    });
    expect(
      firstCallArg(mockPrisma.emailSuppression.updateMany).data,
    ).toMatchObject({ releasedBy: 'admin-user' });
  });
});
