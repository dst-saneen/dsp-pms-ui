import { AssetKind, AssetTrackingMode } from '@prisma/client';

import { ASSET_ERROR_CODES } from './asset-error-codes';

/** Allowed (kind, trackingMode) pairs (plan §4.1 / §14). */
export const ASSET_KIND_TRACKING_PAIRS: ReadonlyArray<
  readonly [AssetKind, AssetTrackingMode]
> = [
  [AssetKind.GENERAL, AssetTrackingMode.LOCATION],
  [AssetKind.GENERAL, AssetTrackingMode.INDIVIDUAL],
  [AssetKind.HARDWARE, AssetTrackingMode.INDIVIDUAL],
  [AssetKind.CARD, AssetTrackingMode.INDIVIDUAL],
  [AssetKind.SOFTWARE_LICENSE, AssetTrackingMode.POOL],
];

export const PHYSICAL_ASSET_KINDS: readonly AssetKind[] = [
  AssetKind.GENERAL,
  AssetKind.HARDWARE,
  AssetKind.CARD,
];

export type AssetCatalog = 'PHYSICAL' | 'LICENSE';

export function kindsForCatalog(catalog: AssetCatalog): AssetKind[] {
  if (catalog === 'LICENSE') {
    return [AssetKind.SOFTWARE_LICENSE];
  }
  return [...PHYSICAL_ASSET_KINDS];
}

export function isValidAssetKindTracking(
  kind: AssetKind,
  trackingMode: AssetTrackingMode,
): boolean {
  return ASSET_KIND_TRACKING_PAIRS.some(
    ([allowedKind, allowedTracking]) =>
      allowedKind === kind && allowedTracking === trackingMode,
  );
}

export function assertValidAssetKindTracking(
  kind: AssetKind | null | undefined,
  trackingMode: AssetTrackingMode | null | undefined,
): asserts kind is AssetKind {
  if (!kind || !trackingMode || !isValidAssetKindTracking(kind, trackingMode)) {
    throw Object.assign(
      new Error(ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID),
      {
        code: ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
      },
    );
  }
}

export function normalizeSerialNumber(
  serialNumber: string | null | undefined,
): string | null {
  if (!serialNumber?.trim()) {
    return null;
  }

  return serialNumber.trim().toUpperCase().replace(/\s+/g, '');
}

export function legacyStatusForLifecycle(input: {
  lifecycleStatus: string;
  archived: boolean;
  hasOpenCustody: boolean;
}): string {
  // Archive is orthogonal to lifecycle; legacy `status` follows §14 mirrors.
  void input.archived;

  switch (input.lifecycleStatus) {
    case 'IN_REPAIR':
    case 'SUSPENDED':
      return 'REPAIR';
    case 'LOST':
      return 'LOST';
    case 'DISPOSED':
    case 'RETIRED':
      return 'DISPOSED';
    default:
      return input.hasOpenCustody ? 'ASSIGNED' : 'AVAILABLE';
  }
}
