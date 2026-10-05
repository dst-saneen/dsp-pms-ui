import { AssetAccessService } from '../../src/modules/asset-domain/asset-access.service';
import { AssetFeatureGateService } from '../../src/modules/asset-domain/asset-feature-gate.service';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('AssetAccessService record scope', () => {
  function createService(grantedDepartmentIds: string[]) {
    const featureGate = new AssetFeatureGateService({
      isEnabled: jest.fn().mockResolvedValue(true),
    } as never);

    return new AssetAccessService(
      {
        departmentAssetGrant: {
          findMany: jest
            .fn()
            .mockResolvedValue(
              grantedDepartmentIds.map((departmentId) => ({ departmentId })),
            ),
        },
      } as never,
      {
        assetWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
      } as never,
      featureGate,
    );
  }

  it('intersects clearance items with granted departments through related assets', async () => {
    const context: AssetAccessContext = {
      userId: 'custodian-1',
      permissions: [ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ],
      activeCompanyId: 'company-a',
    };
    const service = createService(['dept-a']);
    const where = await service.buildClearanceItemWhere(context, 'read');

    expect(where.companyId).toBe('company-a');
    expect(where.OR).toEqual([
      {
        employeeAsset: {
          asset: { companyId: 'company-a', departmentId: { in: ['dept-a'] } },
        },
      },
      {
        licenseAllocation: {
          asset: { companyId: 'company-a', departmentId: { in: ['dept-a'] } },
        },
      },
    ]);
  });

  it('scopes pending transfers to source or destination granted departments', async () => {
    const context: AssetAccessContext = {
      userId: 'custodian-1',
      permissions: [ASSET_PERMISSIONS.DEPARTMENT_READ],
      activeCompanyId: 'company-a',
    };
    const service = createService(['dept-a', 'dept-b']);
    const where = await service.buildTransferWhere(context);

    expect(where).toEqual({
      companyId: 'company-a',
      OR: [
        { fromDepartmentId: { in: ['dept-a', 'dept-b'] } },
        { toDepartmentId: { in: ['dept-a', 'dept-b'] } },
      ],
    });
  });

  it('returns no transfer scope when the actor has no department grants', async () => {
    const context: AssetAccessContext = {
      userId: 'custodian-1',
      permissions: [ASSET_PERMISSIONS.DEPARTMENT_READ],
      activeCompanyId: 'company-a',
    };
    const service = createService([]);
    await expect(service.buildTransferWhere(context)).resolves.toEqual({
      id: '__no_scope__',
    });
  });
});
