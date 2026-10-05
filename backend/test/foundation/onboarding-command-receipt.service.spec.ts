jest.mock('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('onboarding-test-secret'),
}));

import { OnboardingCommandType } from '@prisma/client';

import { OnboardingCommandReceiptService } from '../../src/modules/onboarding-runtime/services/onboarding-command-receipt.service';
import { ONBOARDING_ERROR_CODES } from '../../src/modules/onboarding-runtime/constants/onboarding-error-codes';

describe('OnboardingCommandReceiptService', () => {
  const config = {
    getOrThrow: jest.fn().mockReturnValue('test-secret-path'),
    get: jest.fn().mockReturnValue('v1'),
  };
  const input = {
    companyId: 'company-1',
    operationId: '11111111-1111-4111-8111-111111111111',
    commandType: OnboardingCommandType.CREATE_DESIGNATION_ASSIGNMENT,
    actorUserId: 'user-1',
    requestPayload: { designationId: 'designation-1' },
  };

  function serviceWithReceipt(overrides: Record<string, unknown> = {}) {
    const serviceForHash = new OnboardingCommandReceiptService(
      {} as never,
      config as never,
    );
    const receipt = {
      id: 'receipt-1',
      actorUserId: input.actorUserId,
      commandType: input.commandType,
      requestHash: serviceForHash.computeRequestHash(
        input.requestPayload,
        'v1',
      ),
      requestHashKeyVersion: 'v1',
      resultEntityType: 'DesignationOnboardingAssignment',
      resultEntityId: 'assignment-1',
      safeResultSnapshot: { id: 'assignment-1' },
      completedAt: new Date(),
      ...overrides,
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([receipt]),
    };
    return new OnboardingCommandReceiptService(
      prisma as never,
      config as never,
    );
  }

  it('replays only the same actor, command, and request payload', async () => {
    const service = serviceWithReceipt();

    await expect(service.claimOrReplay(input, 'v1')).resolves.toMatchObject({
      isReplay: true,
      resultEntityId: 'assignment-1',
      safeResultSnapshot: { id: 'assignment-1' },
    });
  });

  it.each([
    { overrides: { actorUserId: 'user-2' }, mismatchKind: 'actor' },
    {
      overrides: {
        commandType: OnboardingCommandType.UPDATE_DESIGNATION_ASSIGNMENT,
      },
      mismatchKind: 'command',
    },
  ])('rejects reuse with a different $mismatchKind', async ({ overrides }) => {
    const service = serviceWithReceipt(overrides);

    await expect(service.claimOrReplay(input, 'v1')).rejects.toMatchObject({
      code: ONBOARDING_ERROR_CODES.OPERATION_ID_REUSED,
    });
  });
});
