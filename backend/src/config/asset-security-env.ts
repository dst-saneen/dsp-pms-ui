export function isAssetCardKekConfigured(raw: string | undefined): boolean {
  const value = raw?.trim();
  if (!value) {
    return false;
  }
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return true;
  }
  return Buffer.from(value, 'base64').length === 32;
}

function decodeHmacKey(raw: string, version: string): Buffer {
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) {
    throw new Error(
      `ASSET_IDEMPOTENCY_HMAC_KEYS_JSON.${version} must be 32 bytes (hex or base64)`,
    );
  }
  return decoded;
}

export function parseAssetIdempotencyHmacKeys(
  raw: string | undefined,
): Record<string, Buffer> {
  if (raw == null || raw.trim() === '') {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ASSET_IDEMPOTENCY_HMAC_KEYS_JSON must be valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ASSET_IDEMPOTENCY_HMAC_KEYS_JSON must be a JSON object');
  }

  const keys: Record<string, Buffer> = {};
  for (const [version, value] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `ASSET_IDEMPOTENCY_HMAC_KEYS_JSON.${version} must be a key string`,
      );
    }
    keys[version] = decodeHmacKey(value, version);
  }

  return keys;
}
