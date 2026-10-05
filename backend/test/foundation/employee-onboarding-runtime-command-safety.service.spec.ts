import { TaskStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ONBOARDING_ERROR_CODES } from '../../src/modules/onboarding-runtime/constants/onboarding-error-codes';
import { ONBOARDING_PERMISSIONS } from '../../src/modules/onboarding-runtime/constants/onboarding-permissions';
import { EmployeeOnboardingRuntimeService } from '../../src/modules/onboarding-runtime/services/employee-onboarding-runtime.service';

describe('EmployeeOnboardingRuntimeService command safety', () => {
  const actor = {
    userId: 'manager-user',
    isGlobal: false,
    permissions: [ONBOARDING_PERMISSIONS.MANAGE],
    assetGrantedDepartmentIds: [],
    organizationContext: { companyId: 'company-1' },
    employeeContext: null,
    roleAssignments: [],
  };
  const record = {
    id: 'onboarding-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    employeeId: 'employee-1',
    version: 4,
    status: TaskStatus.IN_PROGRESS,
    statusV2: 'IN_PROGRESS',
    contractVersion: 'V2',
    tasks: [],
  };
  const completedView = { id: 'onboarding-1', status: 'COMPLETED' };

  function buildService(options?: {
    actorPermissions?: string[];
    allowedActions?: string[];
    featureGateError?: Error;
    transitionCount?: number;
    replay?: boolean;
  }) {
    const tx = {
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue(record),
        updateMany: jest
          .fn()
          .mockResolvedValue({ count: options?.transitionCount ?? 1 }),
      },
      employeeOnboardingTask: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      employeeCareerEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const transactionRunner = {
      run: jest.fn(async (handler: (client: typeof tx) => Promise<unknown>) =>
        handler(tx),
      ),
    };
    const receiptService = {
      getActiveKeyVersion: jest.fn().mockReturnValue('key-v1'),
      claimOrReplay: jest.fn().mockResolvedValue(
        options?.replay
          ? {
              claimed: false,
              isReplay: true,
              receiptId: 'receipt-1',
              safeResultSnapshot: { onboardingId: 'onboarding-1' },
            }
          : {
              claimed: true,
              isReplay: false,
              receiptId: 'receipt-1',
            },
      ),
      completeReceipt: jest.fn().mockResolvedValue(undefined),
    };
    const actorContext = {
      resolve: jest.fn().mockResolvedValue({
        ...actor,
        permissions: options?.actorPermissions ?? actor.permissions,
      }),
    };
    const onboardingScope = {
      loadOnboarding: jest.fn().mockResolvedValue(record),
    };
    const capabilityService = {
      calculateOnboardingActions: jest.fn().mockReturnValue({
        allowedActions: options?.allowedActions ?? ['COMPLETE', 'CANCEL'],
        actionCapabilities: [],
        blockedReasons: [],
      }),
    };
    const featureGateError = options?.featureGateError;
    const featureGate = {
      assertEnabledForContext: featureGateError
        ? jest.fn(() => {
            throw featureGateError;
          })
        : jest.fn(),
    };
    const progressService = {
      calculateFromTasks: jest.fn().mockReturnValue({ canComplete: true }),
    };
    const mapper = {
      mapOnboarding: jest.fn().mockReturnValue(completedView),
    };

    const service = new EmployeeOnboardingRuntimeService(
      {} as never,
      {
        onboardingWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
      } as never,
      onboardingScope as never,
      actorContext as never,
      {} as never,
      featureGate as never,
      receiptService as never,
      transactionRunner as never,
      progressService as never,
      capabilityService as never,
      mapper as never,
      {} as never,
    );

    return {
      service,
      tx,
      transactionRunner,
      receiptService,
      capabilityService,
      featureGate,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims and completes the receipt in the same transaction as completion', async () => {
    const { service, tx, receiptService } = buildService();

    await expect(
      service.complete({ id: 'manager-user' } as never, 'onboarding-1', {
        operationId: '11111111-1111-4111-8111-111111111111',
        expectedOnboardingVersion: 4,
        note: 'Ready',
      }),
    ).resolves.toEqual(completedView);

    expect(receiptService.claimOrReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        commandType: 'COMPLETE_ONBOARDING',
      }),
      'key-v1',
      tx,
    );
    expect(receiptService.completeReceipt).toHaveBeenCalledWith(
      'receipt-1',
      expect.objectContaining({ resultEntityId: 'onboarding-1' }),
      tx,
    );
    expect(tx.employeeOnboarding.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped in mock assertions.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          id: 'onboarding-1',
          version: 4,
          status: TaskStatus.IN_PROGRESS,
        }),
      }),
    );
  });

  it('requires a configured branch timezone before onboarding date snapshots can be created', () => {
    const { service } = buildService();
    const timezoneGuard = service as unknown as {
      requireConfiguredBranchTimezone(
        timezone: string | null | undefined,
      ): string;
    };

    try {
      timezoneGuard.requireConfiguredBranchTimezone(null);
      throw new Error('Expected a missing branch-timezone error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(typeof response).not.toBe('string');
      if (typeof response !== 'string') {
        expect(response).toHaveProperty(
          'code',
          ONBOARDING_ERROR_CODES.ONBOARDING_BRANCH_TIMEZONE_REQUIRED,
        );
      }
    }
    expect(timezoneGuard.requireConfiguredBranchTimezone('Asia/Kolkata')).toBe(
      'Asia/Kolkata',
    );
  });

  it('replays a completed receipt without writing the workflow again', async () => {
    const { service, tx, receiptService, capabilityService } = buildService({
      replay: true,
    });

    await expect(
      service.complete({ id: 'manager-user' } as never, 'onboarding-1', {
        operationId: '11111111-1111-4111-8111-111111111111',
        expectedOnboardingVersion: 4,
      }),
    ).resolves.toEqual(completedView);

    expect(tx.employeeOnboarding.updateMany).not.toHaveBeenCalled();
    expect(tx.employeeOnboardingTask.updateMany).not.toHaveBeenCalled();
    expect(receiptService.completeReceipt).not.toHaveBeenCalled();
    expect(capabilityService.calculateOnboardingActions).not.toHaveBeenCalled();
  });

  it('rejects a lost optimistic-concurrency race and leaves the receipt incomplete only inside the rolled-back transaction', async () => {
    const { service, tx, receiptService } = buildService({
      transitionCount: 0,
    });

    await expect(
      service.cancel({ id: 'manager-user' } as never, 'onboarding-1', {
        operationId: '22222222-2222-4222-8222-222222222222',
        expectedOnboardingVersion: 4,
        reason: 'Cancelled by HR',
      }),
    ).rejects.toMatchObject({
      code: ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
    });

    expect(tx.employeeOnboarding.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped in mock assertions.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ version: 4 }),
      }),
    );
    const claimCalls = receiptService.claimOrReplay.mock
      .calls as unknown as Array<[unknown, string, unknown]>;
    expect(claimCalls[0]?.[2]).toBe(tx);
    expect(receiptService.completeReceipt).not.toHaveBeenCalled();
    expect(tx.employeeOnboardingTask.updateMany).not.toHaveBeenCalled();
  });

  it('cancels through the gated, authorized, versioned receipt contract', async () => {
    const { service, tx, receiptService, featureGate } = buildService();
    const dto = {
      operationId: '22222222-2222-4222-8222-222222222222',
      expectedOnboardingVersion: 4,
      reason: 'Cancelled by HR',
    };

    await expect(
      service.cancel({ id: 'manager-user' } as never, 'onboarding-1', dto),
    ).resolves.toEqual(completedView);

    expect(featureGate.assertEnabledForContext).toHaveBeenCalledWith(
      'company-1',
      'branch-1',
    );
    expect(receiptService.claimOrReplay).toHaveBeenCalledWith(
      {
        companyId: 'company-1',
        operationId: dto.operationId,
        commandType: 'CANCEL_ONBOARDING',
        actorUserId: 'manager-user',
        requestPayload: {
          onboardingId: 'onboarding-1',
          expectedOnboardingVersion: 4,
          reason: 'Cancelled by HR',
        },
      },
      'key-v1',
      tx,
    );
    expect(tx.employeeOnboarding.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'onboarding-1',
        version: 4,
        status: TaskStatus.IN_PROGRESS,
      },
      // Jest asymmetric matchers are intentionally untyped in mock assertions.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        status: TaskStatus.CANCELLED,
        statusV2: 'CANCELLED',
        cancelledByUserId: 'manager-user',
        cancellationReason: 'Cancelled by HR',
        version: { increment: 1 },
      }),
    });
    expect(tx.employeeOnboardingTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: TaskStatus.CANCELLED,
          statusV2: 'CANCELLED',
          version: { increment: 1 },
        },
      }),
    );
    expect(receiptService.completeReceipt).toHaveBeenCalledWith(
      'receipt-1',
      expect.objectContaining({ resultEntityId: 'onboarding-1' }),
      tx,
    );
  });

  it('fails closed at the feature gate before claiming a cancellation receipt', async () => {
    const disabled = new Error('disabled');
    const { service, tx, receiptService } = buildService({
      featureGateError: disabled,
    });

    await expect(
      service.cancel({ id: 'manager-user' } as never, 'onboarding-1', {
        operationId: '22222222-2222-4222-8222-222222222222',
        expectedOnboardingVersion: 4,
        reason: 'Cancelled by HR',
      }),
    ).rejects.toBe(disabled);

    expect(receiptService.claimOrReplay).not.toHaveBeenCalled();
    expect(tx.employeeOnboarding.updateMany).not.toHaveBeenCalled();
  });

  it('does not transition cancellation when runtime capabilities deny it', async () => {
    const { service, tx, receiptService } = buildService({
      allowedActions: ['COMPLETE'],
    });

    await expect(
      service.cancel({ id: 'manager-user' } as never, 'onboarding-1', {
        operationId: '22222222-2222-4222-8222-222222222222',
        expectedOnboardingVersion: 4,
        reason: 'Cancelled by HR',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.employeeOnboarding.updateMany).not.toHaveBeenCalled();
    expect(tx.employeeOnboardingTask.updateMany).not.toHaveBeenCalled();
    expect(receiptService.completeReceipt).not.toHaveBeenCalled();
  });

  it('rejects a non-manager before opening a write transaction', async () => {
    const { service, transactionRunner } = buildService({
      actorPermissions: [ONBOARDING_PERMISSIONS.SELF_READ],
    });

    await expect(
      service.complete({ id: 'employee-user' } as never, 'onboarding-1', {
        operationId: '33333333-3333-4333-8333-333333333333',
        expectedOnboardingVersion: 4,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(transactionRunner.run).not.toHaveBeenCalled();
  });
});
