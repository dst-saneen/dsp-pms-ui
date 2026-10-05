import { getApiErrorCode, getApiErrorMessage } from "@/services/api-client";

const STALE_CODES = new Set([
  "ASSET_VERSION_CONFLICT",
  "STALE_VERSION",
]);

export function assetErrorCode(error: unknown): string {
  return (
    getApiErrorCode(error) ||
    (error instanceof Error ? error.message : "") ||
    ""
  );
}

export function getAssetMutationMessage(
  error: unknown,
  fallback: string,
): string {
  const code = assetErrorCode(error);

  if (STALE_CODES.has(code)) {
    return "This record was updated elsewhere. Review the latest version and try again.";
  }

  return getApiErrorMessage(error, fallback);
}

export function isAssetVersionConflict(error: unknown): boolean {
  return STALE_CODES.has(assetErrorCode(error));
}
