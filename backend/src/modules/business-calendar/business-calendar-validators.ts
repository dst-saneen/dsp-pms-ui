import { isValidIanaTimeZone } from '../leave-policy/leave-calendar.util';

/** ISO 3166-1 alpha-2 (basic format check). */
export function isValidIsoCountryCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return /^[A-Z]{2}$/.test(code.trim().toUpperCase());
}

/**
 * ISO 3166-2 subdivision (e.g. IN-KL). Basic format: CC-SUBDIV.
 * Does not validate against a full registry in Stage 1.
 */
export function isValidIsoSubdivisionCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(code.trim().toUpperCase());
}

export function assertValidIanaTimeZone(
  timeZone: string | null | undefined,
  message = 'Timezone must be a valid IANA timezone',
): string {
  const value = timeZone?.trim();
  if (!value || !isValidIanaTimeZone(value)) {
    throw new Error(message);
  }
  return value;
}

/**
 * Branch/office readiness for calendar publication (work order).
 * Country/subdivision/timezone may be null during migration; publish is blocked until complete.
 */
export function isOfficeLocationReady(input: {
  countryCode?: string | null;
  countrySubdivisionCode?: string | null;
  timezone?: string | null;
}): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!isValidIsoCountryCode(input.countryCode ?? null)) {
    missing.push('countryCode');
  }
  if (!isValidIsoSubdivisionCode(input.countrySubdivisionCode ?? null)) {
    missing.push('countrySubdivisionCode');
  }
  if (!input.timezone || !isValidIanaTimeZone(input.timezone)) {
    missing.push('timezone');
  }
  return { ready: missing.length === 0, missing };
}

export { isValidIanaTimeZone };
