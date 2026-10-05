import { SortOrder } from '../../../common/enums';

/** List sort allowlists (plan §6.6). */
export const ASSET_SORT_ALLOWLISTS = {
  category: ['assetCategoryName', 'createdAt', 'updatedAt'] as const,
  type: ['assetTypeName', 'kind', 'createdAt', 'updatedAt'] as const,
  asset: [
    'assetCode',
    'assetName',
    'warrantyExpiry',
    'createdAt',
    'updatedAt',
  ] as const,
  physicalCustody: [
    'assignedDate',
    'closedAt',
    'createdAt',
    'updatedAt',
  ] as const,
  licenseAllocation: [
    'allocatedAt',
    'revokedAt',
    'createdAt',
    'updatedAt',
  ] as const,
  ownershipTransfer: ['requestedAt', 'decidedAt', 'updatedAt'] as const,
  custodyRequest: [
    'requestedAt',
    'reviewedAt',
    'resolvedAt',
    'updatedAt',
  ] as const,
  clearanceItem: ['createdAt', 'resolvedAt', 'updatedAt'] as const,
  clearanceWaiver: ['requestedAt', 'decidedAt', 'updatedAt'] as const,
} as const;

export type AssetCategorySortField =
  (typeof ASSET_SORT_ALLOWLISTS.category)[number];
export type AssetTypeSortField = (typeof ASSET_SORT_ALLOWLISTS.type)[number];
export type AssetInventorySortField =
  (typeof ASSET_SORT_ALLOWLISTS.asset)[number];

export const ASSET_SORT_DEFAULTS = {
  category: { sortBy: 'assetCategoryName' as const, sortOrder: SortOrder.ASC },
  type: { sortBy: 'assetTypeName' as const, sortOrder: SortOrder.ASC },
  asset: { sortBy: 'createdAt' as const, sortOrder: SortOrder.DESC },
  physicalCustody: {
    sortBy: 'assignedDate' as const,
    sortOrder: SortOrder.DESC,
  },
  licenseAllocation: {
    sortBy: 'allocatedAt' as const,
    sortOrder: SortOrder.DESC,
  },
  ownershipTransfer: {
    sortBy: 'requestedAt' as const,
    sortOrder: SortOrder.DESC,
  },
  custodyRequest: { sortBy: 'requestedAt' as const, sortOrder: SortOrder.DESC },
  clearanceItem: { sortBy: 'createdAt' as const, sortOrder: SortOrder.DESC },
  clearanceWaiver: {
    sortBy: 'requestedAt' as const,
    sortOrder: SortOrder.DESC,
  },
} as const;

export function resolveAssetSortField<T extends string>(
  requested: string | undefined,
  allowlist: readonly T[],
  fallback: T,
): T {
  if (requested && (allowlist as readonly string[]).includes(requested)) {
    return requested as T;
  }

  return fallback;
}

export function resolveAssetSortOrder(
  requested: SortOrder | undefined,
  fallback: SortOrder,
): SortOrder {
  return requested === SortOrder.ASC || requested === SortOrder.DESC
    ? requested
    : fallback;
}

/** Prisma orderBy with deterministic id tie-breaker (plan §6.6). */
export function assetOrderBy<TField extends string>(
  sortBy: TField,
  sortOrder: SortOrder,
): Array<Record<string, SortOrder>> {
  return [{ [sortBy]: sortOrder }, { id: sortOrder }];
}
