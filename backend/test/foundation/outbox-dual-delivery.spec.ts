import { OutboxEventStatus } from '@prisma/client';

import { DeliveryFanoutService } from '../../src/modules/delivery/delivery-fanout.service';
import { DeliveryFeatureGateService } from '../../src/modules/delivery/delivery-feature-gate.service';
import { OutboxProcessorService } from '../../src/modules/outbox/outbox-processor.service';
import {
  PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED,
  PayrollPayslipWorkerService,
} from '../../src/modules/payroll/services/payroll-payslip-worker.service';
import { PAYROLL_ERROR_CODES } from '../../src/modules/payroll/policies/payroll-error-codes';
import { RecruitmentDeliveryProcessor } from '../../src/modules/recruitment/services/recruitment-delivery.processor';
import { UserNotificationService } from '../../src/modules/notification/user-notification.service';
import { TransactionalMailService } from '../../src/modules/mail/transactional-mail.service';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    companyGroupId: 'cg-1',
    companyId: 'co-1',
    branchId: 'br-1',
    aggregateType: 'recruitment',
    aggregateId: 'app-1',
    eventType: 'recruitment.application.received',
    dedupeKey: 'recruit:app-received:app-1',
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    availableAt: new Date(),
    lockedAt: null,
    processedAt: null,
    lastErrorCode: null,
    payload: { candidateId: 'cand-1', recipientUserIds: ['hr-1'] },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OutboxProcessorService — dual delivery mutual exclusivity (P0.5)', () => {
  let mockPrisma: {
    outboxEvent: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let mockConfig: { get: jest.Mock; getOrThrow: jest.Mock };
  let mockNotifications: { create: jest.Mock };
  let mockRecruitment: { process: jest.Mock };
  let mockFanout: { fanOut: jest.Mock };
  let mockGate: {
    isEnabledForCompany: jest.Mock;
  };
  let mockPayslipWorker: { processGenerateEvent: jest.Mock };
  let mockMail: { isAvailable: jest.Mock; sendNotificationAlert: jest.Mock };
  let service: OutboxProcessorService;

  beforeEach(() => {
    mockPrisma = {
      outboxEvent: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    mockConfig = {
      get: jest.fn((key: string) =>
        key === 'FRONTEND_URL' ? 'http://frontend.test/' : 100,
      ),
      getOrThrow: jest.fn(),
    };
    mockNotifications = { create: jest.fn().mockResolvedValue({}) };
    mockRecruitment = { process: jest.fn().mockResolvedValue(undefined) };
    mockFanout = { fanOut: jest.fn().mockResolvedValue(undefined) };
    mockGate = {
      isEnabledForCompany: jest.fn().mockResolvedValue(false),
    };
    mockPayslipWorker = {
      processGenerateEvent: jest.fn().mockResolvedValue('COMPLETED'),
    };
    mockMail = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendNotificationAlert: jest.fn().mockResolvedValue('SENT'),
    };

    service = new OutboxProcessorService(
      mockPrisma as never,
      mockConfig as never,
      mockNotifications as unknown as UserNotificationService,
      mockRecruitment as unknown as RecruitmentDeliveryProcessor,
      mockFanout as unknown as DeliveryFanoutService,
      mockGate as unknown as DeliveryFeatureGateService,
      mockPayslipWorker as unknown as PayrollPayslipWorkerService,
      mockMail as unknown as TransactionalMailService,
    );
  });

  async function handle(event: ReturnType<typeof makeEvent>) {
    await (
      service as unknown as {
        handleEvent: (evt: typeof event) => Promise<void>;
      }
    ).handleEvent(event);
  }

  it('routes an entitled Company to fan-out only (never legacy recruitment)', async () => {
    mockGate.isEnabledForCompany.mockResolvedValue(true);
    const event = makeEvent();

    await handle(event);

    expect(mockFanout.fanOut).toHaveBeenCalledWith(event);
    expect(mockGate.isEnabledForCompany).toHaveBeenCalledWith('co-1');
    expect(mockRecruitment.process).not.toHaveBeenCalled();
    expect(mockNotifications.create).not.toHaveBeenCalled();
    expect(mockMail.sendNotificationAlert).not.toHaveBeenCalled();
  });

  it('routes an entitled workforce event to fan-out only and never invokes legacy SMTP', async () => {
    mockGate.isEnabledForCompany.mockResolvedValue(true);
    const event = makeEvent({
      aggregateType: 'HrRequest',
      aggregateId: 'request-1',
      eventType: 'HR_REQUEST_COMPLETED',
      payload: { recipientUserIds: ['user-1'] },
    });

    await handle(event);

    expect(mockFanout.fanOut).toHaveBeenCalledWith(event);
    expect(mockNotifications.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockMail.sendNotificationAlert).not.toHaveBeenCalled();
  });

  it('routes a Delivery-disabled recruitment Company to legacy processor only', async () => {
    const event = makeEvent();

    await handle(event);

    expect(mockRecruitment.process).toHaveBeenCalledWith(event);
    expect(mockFanout.fanOut).not.toHaveBeenCalled();
    expect(mockNotifications.create).not.toHaveBeenCalled();
  });

  it('routes a Delivery-disabled non-recruitment Company to legacy in-app notifications only', async () => {
    const event = makeEvent({
      eventType: 'leave.approved',
      payload: { recipientUserIds: ['user-1'] },
    });

    await handle(event);

    expect(mockFanout.fanOut).not.toHaveBeenCalled();
    expect(mockRecruitment.process).not.toHaveBeenCalled();
    expect(mockNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        dedupeKey: 'notification:recruit:app-received:app-1:user:user-1',
      }),
    );
  });

  it('adds best-effort SMTP to eligible Delivery-disabled workforce notifications', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'employee@example.test',
      displayName: 'Employee',
      username: 'employee',
      status: 'ACTIVE',
    });

    await handle(
      makeEvent({
        aggregateType: 'LeaveRequest',
        eventType: 'LEAVE_REQUEST_APPROVED',
        payload: { recipientUserIds: ['user-1'] },
      }),
    );

    expect(mockNotifications.create).toHaveBeenCalled();
    expect(mockMail.sendNotificationAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.test',
        clientReference: 'outbox:evt-1:user:user-1',
      }),
    );
  });

  it('continues when SMTP is unavailable or fails after in-app delivery', async () => {
    const event = makeEvent({
      aggregateType: 'LeaveRequest',
      eventType: 'LEAVE_REQUEST_APPROVED',
      payload: { recipientUserIds: ['user-1'] },
    });
    mockMail.isAvailable.mockReturnValue(false);

    await expect(handle(event)).resolves.toBeUndefined();
    expect(mockNotifications.create).toHaveBeenCalled();
    expect(mockMail.sendNotificationAlert).not.toHaveBeenCalled();

    mockMail.isAvailable.mockReturnValue(true);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'employee@example.test',
      displayName: 'Employee',
      username: 'employee',
      status: 'ACTIVE',
    });
    mockMail.sendNotificationAlert.mockRejectedValueOnce(
      new Error('SMTP unavailable'),
    );

    await expect(handle(event)).resolves.toBeUndefined();
  });

  it('does not send legacy SMTP for unknown or internal events', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'employee@example.test',
      displayName: 'Employee',
      username: 'employee',
      status: 'ACTIVE',
    });

    await handle(
      makeEvent({
        eventType: 'payroll.payslip.generate',
        payload: { recipientUserIds: ['user-1'] },
      }),
    );

    expect(mockNotifications.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockMail.sendNotificationAlert).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', { status: 'INACTIVE', email: 'employee@example.test' }],
    ['missing-email', { status: 'ACTIVE', email: null }],
  ])('skips legacy SMTP for a %s recipient', async (_label, userOverride) => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      displayName: 'Employee',
      username: 'employee',
      ...userOverride,
    });

    await handle(
      makeEvent({
        aggregateType: 'LeaveRequest',
        eventType: 'LEAVE_REQUEST_APPROVED',
        payload: { recipientUserIds: ['user-1'] },
      }),
    );

    expect(mockNotifications.create).toHaveBeenCalled();
    expect(mockMail.sendNotificationAlert).not.toHaveBeenCalled();
  });

  it('terminally skips a queued payslip when Payroll is disabled', async () => {
    const event = makeEvent({
      aggregateType: 'PayrollPayslip',
      aggregateId: 'payslip-1',
      eventType: 'payroll.payslip.generate',
      payload: { companyId: 'co-1', payslipId: 'payslip-1' },
    });
    mockPrisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPayslipWorker.processGenerateEvent.mockResolvedValue(
      PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED,
    );

    const result = await service.processBatch(1);

    expect(mockPayslipWorker.processGenerateEvent).toHaveBeenCalledWith({
      payslipId: 'payslip-1',
      companyId: 'co-1',
    });
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      // Jest asymmetric matchers are intentionally untyped in mock assertions.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        status: OutboxEventStatus.PROCESSED,
        lockedAt: null,
        lastErrorCode: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
      }),
    });
    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      failed: 0,
      recovered: 0,
    });
  });
});
