import { AssetLifecycleStatus } from '@prisma/client';

import { LEGACY_ASSET_STATUS_TO_LIFECYCLE } from '../policies/asset-lifecycle-transitions';
import { normalizeSerialNumber } from '../policies/asset-kind-tracking';

import {
  isKnownLegacyAssetStatus,
  isKnownLegacyCustodyStatus,
} from './asset-v2-preflight.queries';
import type { AssetV2MappingFile } from './asset-v2-mapping.types';

export const FATAL_PREFLIGHT_CODES = [
  'UNKNOWN_ASSET_STATUS',
  'UNKNOWN_CUSTODY_STATUS',
  'MULTIPLE_OPEN_ASSIGNMENTS',
  'TERMINAL_CLEARANCE_LIVE_CUSTODY',
  'CLEARANCE_DUPLICATE_ASSET_SUMMARY',
] as const;

export function mapLegacyAssetStatusToLifecycle(
  status: string,
): AssetLifecycleStatus | null {
  return LEGACY_ASSET_STATUS_TO_LIFECYCLE[status] ?? null;
}

export function mapLegacyCustodyStatus(status: string): string | null {
  if (!isKnownLegacyCustodyStatus(status)) {
    return null;
  }
  return status;
}

export function plannedSerialFromExisting(
  serialNumber: string | null | undefined,
) {
  return normalizeSerialNumber(serialNumber);
}

export function assertMappingDoesNotInventPlaceholders(
  mapping: AssetV2MappingFile,
): void {
  for (const [assetId, serial] of Object.entries(mapping.serialByAssetId)) {
    const normalized = normalizeSerialNumber(serial);
    if (
      !normalized ||
      /^PLACEHOLDER/i.test(normalized) ||
      normalized === 'N/A'
    ) {
      throw new Error(
        `serialByAssetId.${assetId} looks manufactured; do not invent placeholder serials`,
      );
    }
  }
  for (const [assetId, location] of Object.entries(mapping.locationByAssetId)) {
    if (
      !location.trim() ||
      /^TBD$/i.test(location) ||
      /^placeholder/i.test(location)
    ) {
      throw new Error(
        `locationByAssetId.${assetId} looks manufactured; do not invent placeholder locations`,
      );
    }
  }
}

export function assertNoUnknownStatuses(input: {
  assetStatuses: string[];
  custodyStatuses: string[];
}): void {
  const unknownAssets = input.assetStatuses.filter(
    (status) => !isKnownLegacyAssetStatus(status),
  );
  const unknownCustody = input.custodyStatuses.filter(
    (status) => !isKnownLegacyCustodyStatus(status),
  );
  if (unknownAssets.length > 0 || unknownCustody.length > 0) {
    throw new Error(
      'Unknown legacy status values stop Asset V2 backfill; correct them before applying',
    );
  }
}

export function legacyMirrorStatusForCustody(custodyStatus: string): string {
  return custodyStatus === 'WAIVED' ? 'LOST' : custodyStatus;
}
