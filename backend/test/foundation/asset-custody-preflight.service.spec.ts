import { AssetCustodyPreflightService } from '../../src/modules/asset-domain/asset-custody-preflight.service';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';

describe('AssetCustodyPreflightService', () => {
  it('allows a same-Branch department change', async () => {
    const service = new AssetCustodyPreflightService();
    const tx = { employeeAsset: { count: jest.fn() } };

    await expect(
      service.assertEmployeeMoveAllowed(tx as never, {
        employeeId: 'emp-1',
        fromBranchId: 'branch-1',
        toBranchId: 'branch-1',
      }),
    ).resolves.toBeUndefined();
    expect(tx.employeeAsset.count).not.toHaveBeenCalled();
  });

  it('blocks a cross-Branch move while physical custody is open', async () => {
    const service = new AssetCustodyPreflightService();
    const tx = {
      employeeAsset: { count: jest.fn().mockResolvedValue(1) },
    };

    await expect(
      service.assertEmployeeMoveAllowed(tx as never, {
        employeeId: 'emp-1',
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
      }),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.EMPLOYEE_ASSET_TRANSFER_BLOCKED,
    });
  });
});
