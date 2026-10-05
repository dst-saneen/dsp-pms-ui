export const ASSET_KINDS = [
  "GENERAL",
  "HARDWARE",
  "CARD",
  "SOFTWARE_LICENSE",
] as const;

export const ASSET_TRACKING_MODES = [
  "LOCATION",
  "INDIVIDUAL",
  "POOL",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type AssetTrackingMode = (typeof ASSET_TRACKING_MODES)[number];

export const ASSET_KIND_TRACKING_PAIRS: ReadonlyArray<
  readonly [AssetKind, AssetTrackingMode]
> = [
  ["GENERAL", "LOCATION"],
  ["GENERAL", "INDIVIDUAL"],
  ["HARDWARE", "INDIVIDUAL"],
  ["CARD", "INDIVIDUAL"],
  ["SOFTWARE_LICENSE", "POOL"],
];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  GENERAL: "General",
  HARDWARE: "Hardware",
  CARD: "Access card",
  SOFTWARE_LICENSE: "Software licence",
};

export const ASSET_TRACKING_LABELS: Record<AssetTrackingMode, string> = {
  LOCATION: "Location",
  INDIVIDUAL: "One item",
  POOL: "Seat pool",
};

export const PHYSICAL_ASSET_KINDS: readonly AssetKind[] = [
  "GENERAL",
  "HARDWARE",
  "CARD",
];

export type AssetCatalog = "PHYSICAL" | "LICENSE";

export function isSoftwareLicenseKind(kind?: AssetKind | null): boolean {
  return kind === "SOFTWARE_LICENSE";
}

export function isPhysicalAssetKind(kind?: AssetKind | null): boolean {
  return Boolean(kind && PHYSICAL_ASSET_KINDS.includes(kind));
}

export function trackingModesForKind(kind: AssetKind): AssetTrackingMode[] {
  return ASSET_KIND_TRACKING_PAIRS.filter(([allowedKind]) => allowedKind === kind).map(
    ([, tracking]) => tracking,
  );
}

export function defaultTrackingMode(kind: AssetKind): AssetTrackingMode {
  return trackingModesForKind(kind)[0] ?? "INDIVIDUAL";
}

export function isPaged<T>(value: unknown): value is {
  items: T[];
  total: number;
  page: number;
  limit: number;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { items?: unknown }).items),
  );
}

export function unwrapPage<T>(
  value: T[] | { items: T[]; total: number; page: number; limit: number } | null | undefined,
): { items: T[]; total: number; page: number; limit: number } {
  if (!value) {
    return { items: [], total: 0, page: 1, limit: 0 };
  }

  if (Array.isArray(value)) {
    return { items: value, total: value.length, page: 1, limit: value.length };
  }

  if (isPaged<T>(value)) {
    return value;
  }

  return { items: [], total: 0, page: 1, limit: 0 };
}
