import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { FileOperationsController } from '../../src/modules/file-storage/file-operations.controller';
import { FileStorageEnabledGuard } from '../../src/modules/file-storage/guards/file-storage-enabled.guard';
import { FileReconciliationService } from '../../src/modules/file-storage/services/file-reconciliation.service';
import { FileRetentionService } from '../../src/modules/file-storage/services/file-retention.service';

describe('File Operations entitlement enforcement', () => {
  const disabledError = new ForbiddenException({
    code: 'FILE_STORAGE_MODULE_NOT_ENABLED',
  });

  it('requires the File Storage guard on every Operations route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      FileOperationsController,
    ) as unknown[] | undefined;

    expect(guards).toContain(FileStorageEnabledGuard);
  });

  it.each([
    [
      'stats',
      (service: FileRetentionService) =>
        service.getOperationsStats('company-1'),
    ],
    [
      'policy list',
      (service: FileRetentionService) => service.listPolicies('company-1'),
    ],
    [
      'policy mutation',
      (service: FileRetentionService) =>
        service.upsertPolicy({
          companyId: 'company-1',
          actorUserId: 'user-1',
          retentionClass: 'EMPLOYEE_DOCUMENT',
          retentionRule: 'DAYS_AFTER_UPLOAD',
          retentionValue: 30,
        }),
    ],
  ])('fails closed before database access for %s', async (_name, operation) => {
    const prisma = {
      fileObject: { count: jest.fn() },
      fileUploadSession: { count: jest.fn() },
      fileOperationAttempt: { count: jest.fn() },
      fileRetentionPolicy: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const features = {
      assertStorageWritesAllowed: jest.fn().mockRejectedValue(disabledError),
    };
    const service = new FileRetentionService(
      prisma as never,
      {} as never,
      features as never,
    );

    await expect(operation(service)).rejects.toBe(disabledError);
    expect(features.assertStorageWritesAllowed).toHaveBeenCalledWith(
      'company-1',
      null,
    );
    expect(prisma.fileObject.count).not.toHaveBeenCalled();
    expect(prisma.fileRetentionPolicy.findMany).not.toHaveBeenCalled();
    expect(prisma.fileRetentionPolicy.upsert).not.toHaveBeenCalled();
  });

  it('blocks reconciliation before storage or database work', async () => {
    const prisma = { fileObject: { findMany: jest.fn() } };
    const storage = { headObject: jest.fn() };
    const features = {
      assertStorageWritesAllowed: jest.fn().mockRejectedValue(disabledError),
    };
    const service = new FileReconciliationService(
      prisma as never,
      storage as never,
      features as never,
    );

    await expect(service.reconcileCompany('company-1')).rejects.toBe(
      disabledError,
    );
    expect(prisma.fileObject.findMany).not.toHaveBeenCalled();
    expect(storage.headObject).not.toHaveBeenCalled();
  });
});
