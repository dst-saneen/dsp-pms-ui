import {
  DomainConflictException,
  requestContextStorage,
} from '../../src/common';
import { EmployeeDocumentService } from '../../src/modules/employee-document/employee-document.service';
import { EmployeeAssetService } from '../../src/modules/employee-asset/employee-asset.service';
import { AssetReturnOutcome } from '../../src/modules/employee-asset/dto/return-asset.dto';
import { withInteractiveTransaction } from './test-mocks';

describe('EmployeeDocumentService validation', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const scopeService = {
    documentWhere: jest.fn().mockReturnValue({}),
    documentTypeWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn(),
    employeeWhere: jest.fn().mockReturnValue({}),
  };

  function createService(prisma: Record<string, unknown>) {
    return new EmployeeDocumentService(
      withInteractiveTransaction(prisma) as never,
      scopeService as never,
      auditService as never,
      { requireCleanSession: jest.fn() } as never,
    );
  }

  it('rejects cross-company employee and document type', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
    });

    const prisma = {
      employeeDocumentType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          companyId: 'company-b',
          requiresDocumentNumber: false,
          requiresExpiry: false,
          lifetimeAllowed: true,
          isActive: true,
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        documentTypeId: 'type-1',
        title: 'Passport',
        lifetimeDocument: true,
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_TYPE_NOT_FOUND' });
  });

  it('requires document number when type requires it', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
    });

    const prisma = {
      employeeDocumentType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          companyId: 'company-a',
          requiresDocumentNumber: true,
          requiresExpiry: false,
          lifetimeAllowed: true,
          isActive: true,
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        documentTypeId: 'type-1',
        title: 'ID Card',
        lifetimeDocument: true,
      }),
    ).rejects.toThrow(/document number/i);
  });
  it('requires expiry date when type requires it', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
    });

    const prisma = {
      employeeDocumentType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          companyId: 'company-a',
          requiresDocumentNumber: false,
          requiresExpiry: true,
          lifetimeAllowed: false,
          isActive: true,
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        documentTypeId: 'type-1',
        title: 'Visa',
        lifetimeDocument: false,
      }),
    ).rejects.toThrow(/expiry date/i);
  });

  it('rejects lifetime documents that include expiry', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
    });

    const prisma = {
      employeeDocumentType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          companyId: 'company-a',
          requiresDocumentNumber: false,
          requiresExpiry: false,
          lifetimeAllowed: true,
          isActive: true,
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        documentTypeId: 'type-1',
        title: 'National ID',
        lifetimeDocument: true,
        expiryDate: '2030-01-01',
      }),
    ).rejects.toThrow(/must not include an expiry/i);
  });

  it('verifies pending documents with authenticated user', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'doc-1',
      verificationStatus: 'VERIFIED',
      verifiedByUserId: 'user-1',
      employeeId: 'emp-1',
      documentTypeId: 'type-1',
      lifetimeDocument: false,
      expiryDate: null,
    });

    const prisma = {
      employeeDocument: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'doc-1',
          verificationStatus: 'PENDING',
          employeeId: 'emp-1',
          documentTypeId: 'type-1',
          lifetimeDocument: false,
          expiryDate: null,
        }),
        update,
      },
    };

    const service = createService(prisma);

    await requestContextStorage.run(
      {
        requestId: 'test',
        userId: 'user-1',
      },
      async () => {
        const result = await service.verify('doc-1', {});
        expect(result.verificationStatus).toBe('VERIFIED');
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              verificationStatus: 'VERIFIED',
              verifiedByUserId: 'user-1',
            }) as unknown,
          }),
        );
      },
    );
  });
});

describe('EmployeeAssetService assignment', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const scopeService = {
    employeeWhere: jest.fn().mockReturnValue({}),
    assetWhere: jest.fn().mockReturnValue({}),
    employeeAssetWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn(),
  };

  function createService(prisma: Record<string, unknown>) {
    return new EmployeeAssetService(
      prisma as never,
      scopeService as never,
      auditService as never,
    );
  }

  it('rejects assignment when asset is not available', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      isActive: true,
      employmentStatus: 'ACTIVE',
    });

    const prisma = {
      asset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          companyId: 'company-a',
          branchId: 'branch-a',
          status: 'ASSIGNED',
          isActive: true,
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        assetId: 'asset-1',
        assignedDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'ASSET_NOT_AVAILABLE' });
  });

  it('rejects cross-company assignment', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      isActive: true,
      employmentStatus: 'ACTIVE',
    });

    const prisma = {
      asset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          companyId: 'company-b',
          branchId: null,
          status: 'AVAILABLE',
          isActive: true,
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        assetId: 'asset-1',
        assignedDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
  });

  it('rejects assignment to inactive employee', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      isActive: false,
      employmentStatus: 'ACTIVE',
    });

    const service = createService({});

    await expect(
      service.create({
        employeeId: 'emp-1',
        assetId: 'asset-1',
        assignedDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET' });
  });

  it('rejects assignment to terminated employee', async () => {
    scopeService.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      isActive: true,
      employmentStatus: 'TERMINATED',
    });

    const service = createService({});

    await expect(
      service.create({
        employeeId: 'emp-1',
        assetId: 'asset-1',
        assignedDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET' });
  });

  it('rejects duplicate return', async () => {
    const prisma = {
      employeeAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ea-1',
          assetId: 'asset-1',
          status: 'RETURNED',
          employee: { companyId: 'company-a' },
          asset: { id: 'asset-1' },
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.returnAsset('ea-1', {
        outcome: AssetReturnOutcome.RETURNED,
        returnedDate: '2026-07-15',
      }),
    ).rejects.toBeInstanceOf(DomainConflictException);
  });

  it('marks asset LOST when return outcome is LOST', async () => {
    const assetUpdate = jest.fn().mockResolvedValue({});
    const assignmentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const assignmentFind = jest.fn().mockResolvedValue({
      id: 'ea-1',
      status: 'LOST',
      assetId: 'asset-1',
    });

    const prisma = {
      employeeAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ea-1',
          assetId: 'asset-1',
          status: 'ASSIGNED',
          employee: { companyId: 'company-a' },
          asset: { id: 'asset-1' },
        }),
        updateMany: assignmentUpdateMany,
        findUniqueOrThrow: assignmentFind,
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ employeeId: 'actor-1' }),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            employeeAsset: {
              updateMany: assignmentUpdateMany,
              findUniqueOrThrow: assignmentFind,
            },
            asset: { update: assetUpdate },
          }),
      ),
    };

    const service = createService(prisma);
    await service.returnAsset('ea-1', {
      outcome: AssetReturnOutcome.LOST,
      returnedDate: '2026-07-15',
    });

    expect(assetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-1' },
        data: { status: 'LOST' },
      }),
    );
  });

  it('marks asset REPAIR when return outcome is DAMAGED', async () => {
    const assetUpdate = jest.fn().mockResolvedValue({});
    const assignmentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const assignmentFind = jest.fn().mockResolvedValue({
      id: 'ea-1',
      status: 'DAMAGED',
      assetId: 'asset-1',
    });

    const prisma = {
      employeeAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ea-1',
          assetId: 'asset-1',
          status: 'ASSIGNED',
          employee: { companyId: 'company-a' },
          asset: { id: 'asset-1' },
        }),
        updateMany: assignmentUpdateMany,
        findUniqueOrThrow: assignmentFind,
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ employeeId: 'actor-1' }),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            employeeAsset: {
              updateMany: assignmentUpdateMany,
              findUniqueOrThrow: assignmentFind,
            },
            asset: { update: assetUpdate },
          }),
      ),
    };

    const service = createService(prisma);
    await service.returnAsset('ea-1', {
      outcome: AssetReturnOutcome.DAMAGED,
      returnedDate: '2026-07-15',
    });

    expect(assetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-1' },
        data: { status: 'REPAIR' },
      }),
    );
  });
});
