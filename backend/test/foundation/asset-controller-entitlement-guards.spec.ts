import { GUARDS_METADATA } from '@nestjs/common/constants';

import { AssetCustodyRequestController } from '../../src/modules/asset-custody-request/asset-custody-request.controller';
import { AssetDepartmentGrantController } from '../../src/modules/asset-department-grant/asset-department-grant.controller';
import { AssetsEnabledGuard } from '../../src/modules/asset-domain';
import { AssetLicenseAllocationController } from '../../src/modules/asset-license-allocation/asset-license-allocation.controller';

describe('Assets HTTP entitlement coverage', () => {
  it.each([
    AssetCustodyRequestController,
    AssetDepartmentGrantController,
    AssetLicenseAllocationController,
  ])('requires AssetsEnabledGuard on %p', (controller) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) as
      unknown[] | undefined;

    expect(guards).toContain(AssetsEnabledGuard);
  });
});
