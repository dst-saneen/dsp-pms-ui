import { AssetKind, AssetTrackingMode } from '@prisma/client';

import {
  isValidAssetKindTracking,
  kindsForCatalog,
  legacyStatusForLifecycle,
  normalizeSerialNumber,
} from '../../src/modules/asset-domain/policies/asset-kind-tracking';

describe('Asset kind/tracking classification', () => {
  it('allows only the contract pairs', () => {
    expect(
      isValidAssetKindTracking(AssetKind.CARD, AssetTrackingMode.INDIVIDUAL),
    ).toBe(true);
    expect(
      isValidAssetKindTracking(
        AssetKind.SOFTWARE_LICENSE,
        AssetTrackingMode.POOL,
      ),
    ).toBe(true);
    expect(
      isValidAssetKindTracking(AssetKind.HARDWARE, AssetTrackingMode.LOCATION),
    ).toBe(false);
    expect(
      isValidAssetKindTracking(AssetKind.CARD, AssetTrackingMode.POOL),
    ).toBe(false);
  });

  it('splits physical kinds from software licences', () => {
    expect(kindsForCatalog('PHYSICAL')).toEqual([
      AssetKind.GENERAL,
      AssetKind.HARDWARE,
      AssetKind.CARD,
    ]);
    expect(kindsForCatalog('LICENSE')).toEqual([AssetKind.SOFTWARE_LICENSE]);
  });

  it('normalizes serial numbers', () => {
    expect(normalizeSerialNumber(' ab 12 ')).toBe('AB12');
    expect(normalizeSerialNumber('  ')).toBeNull();
  });

  it('mirrors lifecycle to legacy status', () => {
    expect(
      legacyStatusForLifecycle({
        lifecycleStatus: 'IN_REPAIR',
        archived: false,
        hasOpenCustody: false,
      }),
    ).toBe('REPAIR');
    expect(
      legacyStatusForLifecycle({
        lifecycleStatus: 'ACTIVE',
        archived: false,
        hasOpenCustody: true,
      }),
    ).toBe('ASSIGNED');
    expect(
      legacyStatusForLifecycle({
        lifecycleStatus: 'ACTIVE',
        archived: true,
        hasOpenCustody: false,
      }),
    ).toBe('AVAILABLE');
    expect(
      legacyStatusForLifecycle({
        lifecycleStatus: 'SUSPENDED',
        archived: false,
        hasOpenCustody: false,
      }),
    ).toBe('REPAIR');
  });
});
