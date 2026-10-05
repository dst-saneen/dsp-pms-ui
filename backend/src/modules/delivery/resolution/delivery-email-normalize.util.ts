const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Canonical email used for Delivery candidate/internal addressing.
 * Returns null when the value is missing or not a safe address.
 */
export function normalizeDeliveryEmail(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(value)) {
    return null;
  }
  return value;
}

export function candidateDisplayName(
  firstName: string,
  lastName?: string | null,
): string {
  return `${firstName} ${lastName ?? ''}`.trim();
}
