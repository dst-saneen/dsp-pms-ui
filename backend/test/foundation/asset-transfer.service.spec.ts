import { AssetTransferStatus } from '@prisma/client';

import { AssetTransferService } from '../../src/modules/asset-domain/asset-transfer.service';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import { withInteractiveTransaction } from './test-mocks';

describe('AssetTransferService', () => {
  const context: AssetAccessContext = {
    userId: 'user-1',
    permissions: [ASSET_PERMISSIONS.ASSETS_MANAGE],
    activeCompanyId: 'company-1',
  };

  it('rejects a second pending transfer for the same asset', async () => {
    const tx = {
      asset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          companyId: 'company-1',
          departmentId: 'dept-a',
          branchId: 'branch-a',
          version: 2,
        }),
      },
      assetOwnershipTransfer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'xfer-1' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = new AssetTransferService(
      withInteractiveTransaction(prisma) as never,
      {
        canManageInventory: jest.fn().mockReturnValue(true),
        buildAssetManageWhere: jest.fn().mockResolvedValue({}),
        assertTransferPair: jest.fn(),
      } as never,
      {
        assertDepartmentInScope: jest.fn().mockResolvedValue({
          id: 'dept-b',
          branchId: 'branch-b',
        }),
      } as never,
      {
        execute: jest.fn(
          async (
            _c: unknown,
            _co: string,
            _t: string,
            _p: unknown,
            run: (client: unknown) => Promise<unknown>,
          ) => prisma.$transaction(run),
        ),
        commandMeta: jest.fn(),
      } as never,
      { log: jest.fn() } as never,
      {
        toTransferResponse: jest.fn(),
        toPaginatedInventory: jest.fn(),
      } as never,
      { getTransferAllowedActions: jest.fn().mockReturnValue([]) } as never,
      { enqueue: jest.fn() } as never,
    );

    await expect(
      service.request(
        'asset-1',
        {
          toDepartmentId: 'dept-b',
          reason: 'Move to IT',
          expectedAssetVersion: 2,
        },
        context,
      ),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_TRANSFER_ALREADY_PENDING,
    });
    expect(tx.assetOwnershipTransfer.create).not.toHaveBeenCalled();
  });

  it('blocks cross-branch accept while physical custody is open', async () => {
    const transfer = {
      id: 'xfer-1',
      assetId: 'asset-1',
      fromBranchId: 'branch-a',
      toBranchId: 'branch-b',
      toDepartmentId: 'dept-b',
      assetVersionAtRequest: 2,
      version: 1,
      status: AssetTransferStatus.PENDING,
      requestedByUserId: 'user-1',
      companyId: 'company-1',
      asset: {
        id: 'asset-1',
        version: 2,
        departmentId: 'dept-a',
        branchId: 'branch-a',
        trackingMode: 'INDIVIDUAL',
      },
    };
    const tx = {
      assetOwnershipTransfer: {
        findFirst: jest.fn().mockResolvedValue(transfer),
        update: jest.fn(),
      },
      employeeAsset: { count: jest.fn().mockResolvedValue(1) },
      assetCustodyRequest: { count: jest.fn().mockResolvedValue(0) },
      asset: { updateMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = new AssetTransferService(
      withInteractiveTransaction(prisma) as never,
      {
        canManageInventory: jest.fn().mockReturnValue(true),
        assertDepartmentManageable: jest.fn(),
        buildAssetInventoryWhere: jest.fn().mockResolvedValue({}),
        buildTransferWhere: jest
          .fn()
          .mockResolvedValue({ companyId: 'company-1' }),
        getActiveGrantedDepartmentIds: jest.fn().mockResolvedValue(['dept-a']),
        assertTransferPair: jest.fn(),
        canForceTransfer: jest.fn().mockReturnValue(false),
        canManageInventoryBroad: jest.fn().mockReturnValue(true),
      } as never,
      {
        assetWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
        assertDepartmentInScope: jest.fn().mockResolvedValue({
          id: 'dept-b',
          branchId: 'branch-b',
        }),
      } as never,
      {
        execute: jest.fn(
          async (
            _c: unknown,
            _co: string,
            _t: string,
            _p: unknown,
            run: (client: unknown) => Promise<unknown>,
          ) => prisma.$transaction(run),
        ),
        commandMeta: jest.fn(),
      } as never,
      { log: jest.fn() } as never,
      {
        toTransferResponse: jest.fn(),
        toPaginatedInventory: jest.fn(),
      } as never,
      { getTransferAllowedActions: jest.fn().mockReturnValue([]) } as never,
      { enqueue: jest.fn() } as never,
    );

    await expect(
      service.accept(
        'xfer-1',
        {
          expectedTransferVersion: 1,
          expectedAssetVersion: 2,
        },
        context,
      ),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_TRANSFER_ACTIVE_CUSTODY,
    });
  });
});
