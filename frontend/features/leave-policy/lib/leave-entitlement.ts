/** Policy UI and API/DB both use yearly entitlement days. */

export const MAX_ANNUAL_ENTITLEMENT = 400;

export function formatAnnualEntitlement(
  annual: number | null | undefined,
): string {
  if (annual == null || !Number.isFinite(Number(annual))) return "";
  const value = Math.round(Number(annual) * 100) / 100;
  return String(value);
}

export function parseAnnualEntitlement(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const annual = Number(trimmed);
  if (!Number.isFinite(annual) || annual <= 0) return null;
  if (annual > MAX_ANNUAL_ENTITLEMENT) return null;
  return Math.round(annual * 100) / 100;
}
