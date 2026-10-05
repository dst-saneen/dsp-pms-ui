import { SortOrder } from '../../src/common/enums';

import { AssetController } from '../../src/modules/asset/asset.controller';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';
import { AssetQueryService } from '../../src/modules/asset-domain/asset-query.service';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('Asset API personas', () => {
  const departmentCustodian: AssetAccessContext = {
    userId: 'custodian-1',
    permissions: [ASSET_PERMISSIONS.DEPARTMENT_READ],
    activeCompanyId: 'company-a',
  };

  it('does not expose a DELETE compatibility alias', () => {
    expect('remove' in AssetController.prototype).toBe(false);
  });

  it('hides foreign inventory from a department custodian', async () => {
    const access = {
      canReadInventory: jest.fn().mockReturnValue(true),
      buildAssetInventoryWhere: jest.fn().mockResolvedValue({
        companyId: 'company-a',
        departmentId: { in: ['dept-a'] },
      }),
      assertAssetInventoryReadable: jest.fn().mockRejectedValue({
        code: ASSET_ERROR_CODES.ASSET_NOT_FOUND,
      }),
    };
    const mapper = {
      toInventoryDetail: jest.fn(),
    };
    const service = new AssetQueryService(
      { asset: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      access as never,
      { getInventoryAllowedActions: jest.fn() } as never,
      mapper as never,
      { employeeWhere: jest.fn() } as never,
    );

    await expect(
      service.findInventoryDetail('foreign-asset', departmentCustodian),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_NOT_FOUND,
    });
  });

  it('returns no eligible assets when the employee fails asset eligibility', async () => {
    const service = new AssetQueryService(
      {
        asset: { findMany: jest.fn(), count: jest.fn() },
        employeeSeparation: {
          findFirst: jest.fn().mockResolvedValue({
            status: 'APPROVED',
            clearance: { id: 'clearance-1' },
          }),
        },
      } as never,
      {
        canReadCustody: jest.fn().mockReturnValue(true),
        canManageCustody: jest.fn().mockReturnValue(true),
        buildCustodyAssetWhere: jest
          .fn()
          .mockResolvedValue({ companyId: 'company-a' }),
      } as never,
      { getInventoryAllowedActions: jest.fn() } as never,
      {
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
        assertEmployeeInScope: jest.fn().mockResolvedValue({
          id: 'emp-1',
          isActive: true,
          employmentStatus: 'ACTIVE',
        }),
      } as never,
    );

    const result = await service.findEligibleForAssignment(
      {
        employeeId: 'emp-1',
        page: 1,
        limit: 10,
        includeInactive: false,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      },
      departmentCustodian,
    );

    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10 });
  });
});
