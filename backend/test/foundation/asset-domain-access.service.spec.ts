import { AssetAccessService } from '../../src/modules/asset-domain/asset-access.service';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('AssetAccessService', () => {
  const organizationScope = {
    assetWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
  };

  const prisma = {
    departmentAssetGrant: {
      findMany: jest.fn(),
    },
    asset: {
      findFirst: jest.fn(),
    },
  };

  const featureGate = {
    assertEnabled: jest.fn(),
    assertTransferPair: jest.fn(),
  };

  function createService() {
    return new AssetAccessService(
      prisma as never,
      organizationScope as never,
      featureGate as never,
    );
  }

  const broadContext: AssetAccessContext = {
    userId: 'user-1',
    permissions: [ASSET_PERMISSIONS.ASSETS_READ],
    activeCompanyId: 'company-a',
  };

  const departmentContext: AssetAccessContext = {
    userId: 'user-2',
    permissions: [ASSET_PERMISSIONS.DEPARTMENT_READ],
    activeCompanyId: 'company-a',
  };

  it('builds org scope for broad inventory readers', async () => {
    const service = createService();

    await expect(
      service.buildAssetInventoryWhere(broadContext),
    ).resolves.toEqual({
      companyId: 'company-a',
    });
  });

  it('restricts department readers to granted departments', async () => {
    prisma.departmentAssetGrant.findMany.mockResolvedValue([
      { departmentId: 'dept-a' },
      { departmentId: 'dept-b' },
    ]);

    const service = createService();

    await expect(
      service.buildAssetInventoryWhere(departmentContext),
    ).resolves.toEqual({
      companyId: 'company-a',
      departmentId: { in: ['dept-a', 'dept-b'] },
    });
  });

  it('returns no-scope when department filter is outside grants', async () => {
    prisma.departmentAssetGrant.findMany.mockResolvedValue([
      { departmentId: 'dept-a' },
    ]);

    const service = createService();

    await expect(
      service.buildAssetInventoryWhere(departmentContext, {
        departmentId: 'dept-b',
      }),
    ).resolves.toEqual({ id: '__no_scope__' });
  });

  it('uses the entitlement gate explicitly and keeps permission checks pure', async () => {
    featureGate.assertEnabled.mockRejectedValueOnce(
      new Error('ASSET_MODULE_NOT_ENABLED'),
    );
    const service = createService();

    expect(service.canReadInventory(broadContext)).toBe(true);
    await expect(service.assertAssetsEnabled(broadContext)).rejects.toThrow(
      /ASSET_MODULE_NOT_ENABLED/,
    );
    expect(featureGate.assertEnabled).toHaveBeenCalledWith(broadContext);
  });
});
