import { AssetClearanceItemStatus } from '@prisma/client';

import { AssetClearanceService } from '../../src/modules/asset-domain/asset-clearance.service';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';

describe('AssetClearanceService separation preflight', () => {
  const context: AssetAccessContext = {
    userId: 'hr-1',
    permissions: [ASSET_PERMISSIONS.ASSIGNMENTS_READ, 'hr.employees.manage'],
    activeCompanyId: 'company-1',
  };

  function createService(prisma: Record<string, unknown>) {
    return new AssetClearanceService(
      prisma as never,
      {
        canReadClearance: jest.fn().mockReturnValue(true),
        canManageCustody: jest.fn().mockReturnValue(true),
        canWaiveClearance: jest.fn().mockReturnValue(true),
        canManageInventoryBroad: jest.fn().mockReturnValue(true),
        buildClearanceItemWhere: jest.fn().mockResolvedValue({}),
      } as never,
      {
        assertEmployeeInScope: jest.fn().mockResolvedValue({ id: 'emp-1' }),
        assetWhere: jest.fn().mockReturnValue({}),
      } as never,
      {
        execute: jest.fn(),
        commandMeta: jest.fn(),
      } as never,
      { log: jest.fn() } as never,
      {
        toClearanceItemResponse: jest.fn((item: unknown) => item),
        toClearanceWaiverResponse: jest.fn((row: unknown) => row),
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
        getWaiverAllowedActions: jest.fn().mockReturnValue([]),
      } as never,
      { enqueue: jest.fn() } as never,
      { waiveInTransaction: jest.fn() } as never,
      { waiveInTransaction: jest.fn() } as never,
    );
  }

  it('blocks exit while a laptop assignment is still open', async () => {
    const prisma = {
      employeeAsset: { count: jest.fn().mockResolvedValue(1) },
      softwareLicenseAllocation: { count: jest.fn().mockResolvedValue(0) },
      assetClearanceItem: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = createService(prisma);

    await expect(service.assertResolved('emp-1')).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_CLEARANCE_BLOCKED,
    });
  });

  it('allows exit after the open assignment is waived', async () => {
    const prisma = {
      employeeAsset: { count: jest.fn().mockResolvedValue(0) },
      softwareLicenseAllocation: { count: jest.fn().mockResolvedValue(0) },
      assetClearanceItem: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = createService(prisma);

    await expect(service.assertResolved('emp-1')).resolves.toBeUndefined();
    expect(prisma.assetClearanceItem.count).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1', status: AssetClearanceItemStatus.OPEN },
    });
  });

  it('reports live outstanding custody on preflight', async () => {
    const prisma = {
      employeeAsset: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ea-laptop',
            version: 1,
            assetId: 'laptop-1',
            asset: {
              id: 'laptop-1',
              assetCode: 'HW-1',
              assetName: 'Laptop',
              version: 3,
            },
          },
        ]),
      },
      softwareLicenseAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = createService(prisma);

    await expect(service.preflight('emp-1', context)).resolves.toMatchObject({
      employeeId: 'emp-1',
      blocked: true,
      openAssignments: [expect.objectContaining({ id: 'ea-laptop' })],
    });
  });
});
