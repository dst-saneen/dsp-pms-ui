function decodeKeyMaterial(
  raw: string,
  label: string,
  version: string,
): Buffer {
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) {
    throw new Error(`${label}.${version} must be 32 bytes (hex or base64)`);
  }
  return decoded;
}

export function parseDeliveryVersionedKeys(
  raw: string | undefined,
  envName: string,
): Record<string, Buffer> {
  if (raw == null || raw.trim() === '') {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${envName} must be valid JSON`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${envName} must be a JSON object`);
  }

  const keys: Record<string, Buffer> = {};
  for (const [version, value] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${envName}.${version} must be a key string`);
    }
    keys[version] = decodeKeyMaterial(value, envName, version);
  }

  return keys;
}
