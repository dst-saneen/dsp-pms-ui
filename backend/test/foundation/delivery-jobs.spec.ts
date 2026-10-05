import { Logger } from '@nestjs/common';
import { DeliveryMessageStatus, Prisma } from '@prisma/client';

import { DeliveryLeaseRecoveryService } from '../../src/modules/delivery/delivery-lease-recovery.service';
import { DeliveryJobsScheduler } from '../../src/modules/delivery/delivery-jobs.scheduler';

describe('DeliveryLeaseRecoveryService', () => {
  it('moves expired PROCESSING without acceptance evidence to RETRY_WAIT', async () => {
    const updateMany = jest.fn((args: Record<string, unknown>) => {
      void args;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      deliveryMessage: {
        findMany: jest.fn().mockResolvedValue([{ id: 'dm-1', attempts: [] }]),
        updateMany,
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'DELIVERY_WORKER_BATCH_SIZE') return 50;
        return undefined;
      }),
    };

    const svc = new DeliveryLeaseRecoveryService(
      prisma as never,
      config as never,
    );
    const result = await svc.recoverExpiredLeases();

    expect(result.returnedToRetryWait).toBe(1);
    expect(result.movedToReconciling).toBe(0);
    const [retryArg] = updateMany.mock.calls;
    expect(retryArg[0].data).toMatchObject({
      status: DeliveryMessageStatus.RETRY_WAIT,
    });
  });

  it('moves expired PROCESSING with ACCEPTED attempt to RECONCILING', async () => {
    const updateMany = jest.fn((args: Record<string, unknown>) => {
      void args;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      deliveryMessage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'dm-2',
            attempts: [{ id: 'da-1', providerRequestId: 'req-1' }],
          },
        ]),
        updateMany,
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'DELIVERY_WORKER_BATCH_SIZE') return 50;
        return undefined;
      }),
    };

    const svc = new DeliveryLeaseRecoveryService(
      prisma as never,
      config as never,
    );
    const result = await svc.recoverExpiredLeases();

    expect(result.movedToReconciling).toBe(1);
    expect(result.returnedToRetryWait).toBe(0);
    const [reconcilingArg] = updateMany.mock.calls;
    expect(reconcilingArg[0].data).toMatchObject({
      status: DeliveryMessageStatus.RECONCILING,
    });
  });

  it('recovers leases without a deployment rollout flag', async () => {
    const prisma = {
      deliveryMessage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'DELIVERY_WORKER_BATCH_SIZE' ? 50 : undefined,
      ),
    };
    const svc = new DeliveryLeaseRecoveryService(
      prisma as never,
      config as never,
    );
    const result = await svc.recoverExpiredLeases();
    expect(result).toEqual({ returnedToRetryWait: 0, movedToReconciling: 0 });
    expect(prisma.deliveryMessage.findMany).toHaveBeenCalled();
  });
});

describe('DeliveryJobsScheduler', () => {
  it('reports worker infrastructure and Company delivery availability separately', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'WORKFORCE_JOBS_ENABLED') return true;
        return undefined;
      }),
    };
    const featureGate = {
      hasAnyEnabledCompany: jest.fn().mockResolvedValue(false),
      isEnabledForCompany: jest.fn(),
    };
    const scheduler = new DeliveryJobsScheduler(
      config as never,
      { processBatch: jest.fn() } as never,
      { processBatch: jest.fn() } as never,
      { recoverExpiredLeases: jest.fn() } as never,
      featureGate as never,
    );

    await expect(scheduler.getHealth()).resolves.toMatchObject({
      jobsEnabled: true,
      workforceJobsEnabled: true,
      deliveryEnabledForAnyCompany: false,
    });
    expect(featureGate.hasAnyEnabledCompany).toHaveBeenCalledTimes(1);
  });

  it('skips email worker when jobs are disabled', async () => {
    const emailWorker = { processBatch: jest.fn() };
    const config = {
      get: jest.fn().mockReturnValue(false),
    };
    const scheduler = new DeliveryJobsScheduler(
      config as never,
      emailWorker as never,
      { processBatch: jest.fn() } as never,
      { recoverExpiredLeases: jest.fn() } as never,
      {
        hasAnyEnabledCompany: jest.fn().mockResolvedValue(false),
        isEnabledForCompany: jest.fn(),
      } as never,
    );

    await scheduler.runEmailWorker();
    expect(emailWorker.processBatch).not.toHaveBeenCalled();
  });

  it('logs a Prisma code without the worker error message', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const emailWorker = {
      processBatch: jest
        .fn()
        .mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError(
            'database host and password must not leak',
            { code: 'P2025', clientVersion: 'test' },
          ),
        ),
    };
    const scheduler = new DeliveryJobsScheduler(
      { get: jest.fn().mockReturnValue(true) } as never,
      emailWorker as never,
      { processBatch: jest.fn() } as never,
      { recoverExpiredLeases: jest.fn() } as never,
      {
        hasAnyEnabledCompany: jest.fn().mockResolvedValue(false),
        isEnabledForCompany: jest.fn(),
      } as never,
    );

    await scheduler.runEmailWorker();

    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'delivery.jobs.email.failed',
        errorCode: 'P2025',
      }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      'database host and password must not leak',
    );
    loggerError.mockRestore();
  });
});
