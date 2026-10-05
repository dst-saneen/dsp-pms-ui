import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
} from '@prisma/client';

import { DomainConflictException } from '../../src/common';
import { AssetCustodyService } from '../../src/modules/asset-domain/asset-custody.service';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import { AssetCustodyCloseOutcome } from '../../src/modules/asset-domain/dto/close-employee-asset-command.dto';
import { withInteractiveTransaction } from './test-mocks';

describe('AssetCustodyService', () => {
  const context: AssetAccessContext = {
    userId: 'user-1',
    permissions: [ASSET_PERMISSIONS.ASSIGNMENTS_MANAGE],
    activeCompanyId: 'company-1',
  };

  const employee = {
    id: 'emp-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    departmentId: 'dept-1',
    isActive: true,
    employmentStatus: 'ACTIVE',
  };

  const availableAsset = {
    id: 'asset-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    version: 1,
    status: 'AVAILABLE',
    isActive: true,
    archivedAt: null,
    lifecycleStatus: AssetLifecycleStatus.ACTIVE,
    trackingMode: AssetTrackingMode.INDIVIDUAL,
    kind: AssetKind.HARDWARE,
    warrantyExpiry: null,
  };

  function createService(prisma: Record<string, unknown>) {
    const access = {
      canManageCustody: jest.fn().mockReturnValue(true),
      canReadCustody: jest.fn().mockReturnValue(true),
      buildCustodyAssetWhere: jest.fn().mockResolvedValue({}),
    };
    const organizationScope = {
      assertEmployeeInScope: jest.fn().mockResolvedValue(employee),
    };
    const idempotency = {
      execute: jest.fn(
        async (
          _context: unknown,
          _companyId: string,
          _commandType: string,
          _payload: unknown,
          run: (tx: unknown) => Promise<{ entityId: string }>,
        ) => {
          const result = await (
            prisma as {
              $transaction: (
                cb: (tx: unknown) => Promise<unknown>,
              ) => Promise<{ entityId: string }>;
            }
          ).$transaction(run);
          return { id: result.entityId };
        },
      ),
      commandMeta: (entityType: string, entityId: string) => ({
        entityType,
        entityId,
        snapshot: { id: entityId, type: entityType },
      }),
    };

    return new AssetCustodyService(
      withInteractiveTransaction(prisma) as never,
      access as never,
      organizationScope as never,
      idempotency as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      { toSafeSnapshot: jest.fn((value: unknown) => value) } as never,
      {
        toEmployeeAssetResponse: jest.fn((row: unknown) => row),
        toPaginatedInventory: jest.fn(
          (items: unknown[], total: number, page: number, limit: number) => ({
            items,
            total,
            page,
            limit,
          }),
        ),
      } as never,
      {
        getEmployeeAssetAllowedActions: jest.fn().mockReturnValue([]),
      } as never,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
    );
  }

  it('allows exactly one concurrent assignment to claim AVAILABLE', async () => {
    let assetStatus = 'AVAILABLE';
    const tx = {
      employeeSeparation: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: {
        findFirst: jest.fn().mockResolvedValue(availableAsset),
        updateMany: jest.fn().mockImplementation(() => {
          if (assetStatus !== 'AVAILABLE') {
            return Promise.resolve({ count: 0 });
          }
          assetStatus = 'ASSIGNED';
          return Promise.resolve({ count: 1 });
        }),
      },
      employeeAsset: {
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = createService(prisma);

    const results = await Promise.allSettled([
      service.assign(
        {
          employeeId: 'emp-1',
          assetId: 'asset-1',
          assignedDate: '2026-08-03',
        },
        context,
      ),
      service.assign(
        {
          employeeId: 'emp-1',
          assetId: 'asset-1',
          assignedDate: '2026-08-03',
        },
        context,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({ code: 'ASSET_ALREADY_ASSIGNED' });
  });

  it('rejects assignment to an inactive employee', async () => {
    const organizationScope = {
      assertEmployeeInScope: jest.fn().mockResolvedValue({
        ...employee,
        isActive: false,
      }),
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            employeeSeparation: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            asset: { findFirst: jest.fn(), updateMany: jest.fn() },
            employeeAsset: { create: jest.fn() },
          }),
      ),
    };
    const service = new AssetCustodyService(
      withInteractiveTransaction(prisma) as never,
      {
        canManageCustody: jest.fn().mockReturnValue(true),
        canReadCustody: jest.fn().mockReturnValue(true),
        buildCustodyAssetWhere: jest.fn().mockResolvedValue({}),
      } as never,
      organizationScope as never,
      {
        execute: jest.fn(
          async (
            _c: unknown,
            _co: string,
            _t: string,
            _p: unknown,
            run: (tx: unknown) => Promise<unknown>,
          ) => prisma.$transaction(run),
        ),
        commandMeta: jest.fn(),
      } as never,
      { log: jest.fn() } as never,
      { toSafeSnapshot: jest.fn() } as never,
      { toEmployeeAssetResponse: jest.fn() } as never,
      { getEmployeeAssetAllowedActions: jest.fn() } as never,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      service.assign(
        {
          employeeId: 'emp-1',
          assetId: 'asset-1',
          assignedDate: '2026-08-03',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET' });
  });

  it('rejects physical assignment when employee branch does not match', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    const tx = {
      employeeSeparation: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: {
        findFirst: jest.fn().mockResolvedValue({
          ...availableAsset,
          branchId: 'branch-other',
        }),
        updateMany: jest.fn(),
      },
      employeeAsset: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const service = createService(prisma);

    await expect(
      service.assign(
        {
          employeeId: 'emp-1',
          assetId: 'asset-1',
          assignedDate: '2026-08-03',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'ASSET_EMPLOYEE_BRANCH_MISMATCH' });
  });

  it('allows exactly one concurrent return to close an assignment', async () => {
    let assignmentStatus = 'ASSIGNED';
    const assignment = {
      id: 'assignment-1',
      assetId: 'asset-1',
      status: 'ASSIGNED',
      returnedDate: null,
      closedAt: null,
      version: 1,
      assignedDate: new Date('2026-08-01'),
      asset: { id: 'asset-1', version: 1 },
    };
    const tx = {
      employeeAsset: {
        findFirst: jest.fn().mockResolvedValue(assignment),
        updateMany: jest.fn().mockImplementation(() => {
          if (assignmentStatus !== 'ASSIGNED') {
            return Promise.resolve({ count: 0 });
          }
          assignmentStatus = 'RETURNED';
          return Promise.resolve({ count: 1 });
        }),
      },
      asset: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      assetCustodyRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      assetClearanceItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = createService(prisma);

    const results = await Promise.allSettled([
      service.close(
        'assignment-1',
        {
          outcome: AssetCustodyCloseOutcome.RETURNED,
          returnedDate: '2026-08-03',
        },
        context,
      ),
      service.close(
        'assignment-1',
        {
          outcome: AssetCustodyCloseOutcome.RETURNED,
          returnedDate: '2026-08-03',
        },
        context,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toBeInstanceOf(DomainConflictException);
    expect(rejected?.reason).toMatchObject({
      code: 'ASSET_ASSIGNMENT_ALREADY_CLOSED',
    });
  });
});
