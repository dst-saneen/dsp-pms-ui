import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
  LicenseAllocationStatus,
} from '@prisma/client';

import { LicenseAllocationService } from '../../src/modules/asset-domain/license-allocation.service';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import { hashAssetSourceCommand } from '../../src/modules/asset-domain/policies/asset-source-command';
import { withInteractiveTransaction } from './test-mocks';

describe('LicenseAllocationService', () => {
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

  const pool = {
    id: 'pool-1',
    companyId: 'company-1',
    version: 1,
    isActive: true,
    archivedAt: null,
    lifecycleStatus: AssetLifecycleStatus.ACTIVE,
    trackingMode: AssetTrackingMode.POOL,
    kind: AssetKind.SOFTWARE_LICENSE,
    softwareLicenseDetail: {
      seatCapacity: 1,
      allocatedSeatCount: 0,
      expiresOn: null,
    },
  };

  function createService(prisma: Record<string, unknown>) {
    const access = {
      canManageCustody: jest.fn().mockReturnValue(true),
      canReadCustody: jest.fn().mockReturnValue(true),
      buildCustodyAssetWhere: jest.fn().mockResolvedValue({}),
      assertLicensePoolScope: jest.fn(),
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
                cb: (tx: unknown) => Promise<{ entityId: string }>,
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

    return new LicenseAllocationService(
      withInteractiveTransaction(prisma) as never,
      access as never,
      organizationScope as never,
      idempotency as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      { toSafeSnapshot: jest.fn((value: unknown) => value) } as never,
      {
        toLicenseAllocationResponse: jest.fn((row: unknown) => row),
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
        getLicenseAllocationAllowedActions: jest.fn().mockReturnValue([]),
      } as never,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
    );
  }

  it('never allocates more seats than pool capacity', async () => {
    let allocatedSeatCount = 0;
    const seatCapacity = 1;
    const tx = {
      employeeSeparation: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: {
        findFirst: jest.fn().mockResolvedValue(pool),
        update: jest.fn().mockResolvedValue({}),
      },
      softwareLicenseAllocation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: { employeeId: string } }) =>
            Promise.resolve({ id: `alloc-${data.employeeId}` }),
          ),
      },
      $queryRaw: jest.fn().mockImplementation(() => {
        if (allocatedSeatCount >= seatCapacity) {
          return Promise.resolve([]);
        }
        allocatedSeatCount += 1;
        return Promise.resolve([{ allocatedSeatCount }]);
      }),
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = createService(prisma);

    const results = await Promise.allSettled([
      service.allocate(
        'pool-1',
        { employeeId: 'emp-1', allocatedDate: '2026-08-03' },
        context,
      ),
      service.allocate(
        'pool-1',
        { employeeId: 'emp-2', allocatedDate: '2026-08-03' },
        context,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({
      code: 'LICENSE_NO_SEATS_AVAILABLE',
    });
    expect(allocatedSeatCount).toBe(1);
  });

  it('rejects allocation when the pool is suspended', async () => {
    const tx = {
      employeeSeparation: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: {
        findFirst: jest.fn().mockResolvedValue({
          ...pool,
          lifecycleStatus: AssetLifecycleStatus.SUSPENDED,
        }),
      },
      softwareLicenseAllocation: { findFirst: jest.fn(), create: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.allocate(
        'pool-1',
        { employeeId: 'emp-1', allocatedDate: '2026-08-03' },
        context,
      ),
    ).rejects.toMatchObject({ code: 'LICENSE_POOL_NOT_ACTIVE' });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects a second active allocation for the same employee', async () => {
    const tx = {
      employeeSeparation: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: { findFirst: jest.fn().mockResolvedValue(pool) },
      softwareLicenseAllocation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'alloc-1',
          status: LicenseAllocationStatus.ACTIVE,
        }),
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.allocate(
        'pool-1',
        { employeeId: 'emp-1', allocatedDate: '2026-08-03' },
        context,
      ),
    ).rejects.toMatchObject({ code: 'LICENSE_ALLOCATION_EXISTS' });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns an existing allocation on source retry without incrementing seats again', async () => {
    const employee = {
      id: 'emp-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      departmentId: 'dept-1',
      isActive: true,
      employmentStatus: 'ACTIVE',
    };
    const pool = {
      id: 'pool-1',
      companyId: 'company-1',
      version: 1,
      isActive: true,
      archivedAt: null,
      lifecycleStatus: AssetLifecycleStatus.ACTIVE,
      trackingMode: AssetTrackingMode.POOL,
      kind: AssetKind.SOFTWARE_LICENSE,
      softwareLicenseDetail: {
        seatCapacity: 1,
        allocatedSeatCount: 0,
        expiresOn: null,
      },
    };
    const sourceCommandHash = hashAssetSourceCommand({
      companyId: pool.companyId,
      sourceType: 'ONBOARDING_TASK',
      sourceId: 'task-1',
      sourceCommandKey: 'onboarding:task-1',
      employeeId: employee.id,
      assetId: pool.id,
      effectiveDate: '2026-08-19',
      commandKind: 'ALLOCATE',
    });
    const existingAllocation = {
      id: 'alloc-existing',
      companyId: 'company-1',
      sourceCommandKey: 'onboarding:task-1',
      sourceCommandHash,
    };
    const tx = {
      employeeSeparation: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: {
        findFirst: jest.fn().mockResolvedValue(pool),
        update: jest.fn(),
      },
      softwareLicenseAllocation: {
        findFirst: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { sourceCommandKey?: string } }) => {
              if (where.sourceCommandKey) {
                return Promise.resolve(existingAllocation);
              }
              return Promise.resolve(null);
            },
          ),
      },
      $queryRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn() };
    const service = createService(prisma);
    const organizationScope = (
      service as unknown as {
        organizationScope: { assertEmployeeInScope: jest.Mock };
      }
    ).organizationScope;
    organizationScope.assertEmployeeInScope.mockResolvedValue(employee);

    const result = await service.allocateWithinTransaction(
      tx as never,
      'pool-1',
      {
        assetId: 'pool-1',
        employeeId: employee.id,
        actorUserId: 'user-1',
        sourceType: 'ONBOARDING_TASK',
        sourceId: 'task-1',
        sourceCommandKey: 'onboarding:task-1',
        effectiveDate: '2026-08-19',
        expectedAssetVersion: 1,
      },
    );

    expect(result).toEqual(existingAllocation);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.asset.update).not.toHaveBeenCalled();
  });
});
