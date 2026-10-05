import { createHmac } from 'node:crypto';

export const PROJECT_REQUEST_HASH_FORMAT_VERSION = 1;

/**
 * Stable canonical JSON for Project command receipt HMAC
 * (aligned with Asset idempotency hashing).
 */
export function stableStringifyProjectPayload(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          trimmed,
        )
      ) {
        return JSON.stringify(trimmed.toLowerCase());
      }
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyProjectPayload(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringifyProjectPayload(record[key])}`,
    )
    .join(',')}}`;
}

export function buildProjectRequestCanonical(input: {
  formatVersion: number;
  companyId: string;
  actorUserId: string;
  commandType: string;
  operationId: string;
  payload: unknown;
}): string {
  return stableStringifyProjectPayload({
    formatVersion: input.formatVersion,
    companyId: input.companyId.trim().toLowerCase(),
    actorUserId: input.actorUserId.trim().toLowerCase(),
    commandType: input.commandType,
    operationId: input.operationId.trim().toLowerCase(),
    payload: input.payload,
  });
}

export function hmacProjectRequestHash(key: Buffer, canonical: string): string {
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
}
