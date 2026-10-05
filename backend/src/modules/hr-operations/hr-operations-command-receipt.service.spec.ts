import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { HrOperationsCommandReceiptService } from './hr-operations-command-receipt.service';

describe('HrOperationsCommandReceiptService', () => {
  it('maps the final serializable retry failure to a stable state-conflict code', async () => {
    const serializationFailure = new Prisma.PrismaClientKnownRequestError(
      'serialization failure',
      { code: 'P2034', clientVersion: 'test' },
    );
    const prisma = {
      hrCommandReceipt: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockRejectedValue(serializationFailure),
    };
    const config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'HR_OPERATIONS_IDEMPOTENCY_HMAC_ACTIVE_VERSION')
          return 'v1';
        return undefined;
      }),
    };
    const service = new HrOperationsCommandReceiptService(
      prisma as never,
      config as never,
    );

    try {
      await service.execute({
        companyId: 'company-1',
        actorUserId: 'user-1',
        commandType: 'CREATE_HR_REQUEST',
        operationId: 'operation-1',
        requestPayload: { requestTypeId: 'request-type-1' },
        stateChangedCode: 'HR_REQUEST_STATE_CHANGED',
        execute: jest.fn(),
      });
      fail('Expected a conflict after bounded serialization retries');
    } catch (error) {
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'HR_REQUEST_STATE_CHANGED',
      });
    }
  });
});
