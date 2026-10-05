import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
} from '@prisma/client';

import {
  assertEmployeeEligibleForAsset,
  assertIndividualAssetAssignable,
  assertLicensePoolAllocatable,
} from '../../src/modules/asset-domain/policies/asset-employee-eligibility';

describe('asset employee eligibility', () => {
  it('rejects inactive and terminal employees', () => {
    expect(() =>
      assertEmployeeEligibleForAsset({
        isActive: false,
        employmentStatus: 'ACTIVE',
        hasNonTerminalSeparation: false,
        hasStartedClearance: false,
      }),
    ).toThrow(/EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET|inactive/);

    expect(() =>
      assertEmployeeEligibleForAsset({
        isActive: true,
        employmentStatus: 'TERMINATED',
        hasNonTerminalSeparation: false,
        hasStartedClearance: false,
      }),
    ).toThrow();
  });

  it('allows NOTICE only before clearance has started', () => {
    expect(() =>
      assertEmployeeEligibleForAsset({
        isActive: true,
        employmentStatus: 'NOTICE',
        hasNonTerminalSeparation: true,
        hasStartedClearance: false,
      }),
    ).not.toThrow();

    expect(() =>
      assertEmployeeEligibleForAsset({
        isActive: true,
        employmentStatus: 'NOTICE',
        hasNonTerminalSeparation: true,
        hasStartedClearance: true,
      }),
    ).toThrow();
  });

  it('rejects location-tracked assets for individual assignment', () => {
    expect(() =>
      assertIndividualAssetAssignable({
        kind: AssetKind.GENERAL,
        trackingMode: AssetTrackingMode.LOCATION,
        lifecycleStatus: AssetLifecycleStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
        warrantyExpiry: null,
      }),
    ).toThrow();
  });

  it('rejects suspended licence pools', () => {
    expect(() =>
      assertLicensePoolAllocatable({
        kind: AssetKind.SOFTWARE_LICENSE,
        trackingMode: AssetTrackingMode.POOL,
        lifecycleStatus: AssetLifecycleStatus.SUSPENDED,
        isActive: true,
        archivedAt: null,
      }),
    ).toThrow();
  });
});
