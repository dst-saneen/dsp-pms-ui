import { DomainConflictException } from '../../src/common';
import { AssetFeatureGateService } from '../../src/modules/asset-domain/asset-feature-gate.service';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';

describe('Asset module entitlement gate', () => {
  const entitlements = {
    isEnabled: jest.fn(),
  };

  beforeEach(() => {
    entitlements.isEnabled.mockReset();
  });

  it('uses the Company entitlement for every Branch', async () => {
    entitlements.isEnabled.mockResolvedValue(true);
    const service = new AssetFeatureGateService(entitlements as never);

    await expect(
      service.assertEnabled({
        userId: 'user-1',
        permissions: [],
        activeCompanyId: 'company-1',
        activeBranchId: 'branch-a',
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertEnabled({
        userId: 'user-1',
        permissions: [],
        activeCompanyId: 'company-1',
        activeBranchId: 'branch-b',
      }),
    ).resolves.toBeUndefined();
    expect(entitlements.isEnabled).toHaveBeenCalledWith('company-1', 'ASSETS');
  });

  it('fails closed when the Company has no Assets entitlement', async () => {
    entitlements.isEnabled.mockResolvedValue(false);
    const service = new AssetFeatureGateService(entitlements as never);

    await expect(
      service.assertEnabled({ userId: 'user-1', permissions: [] }),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.ASSET_MODULE_NOT_ENABLED,
    });
  });

  it('requires both transfer Branch identifiers before checking entitlement', async () => {
    const service = new AssetFeatureGateService(entitlements as never);

    await expect(
      service.assertTransferPair({
        companyId: 'company-1',
        fromBranchId: 'branch-a',
        toBranchId: null,
      }),
    ).rejects.toBeInstanceOf(DomainConflictException);
    expect(entitlements.isEnabled).not.toHaveBeenCalled();
  });
});
