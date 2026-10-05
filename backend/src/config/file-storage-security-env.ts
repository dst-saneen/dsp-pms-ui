export function parseFileNameEncryptionKeys(
  raw: string | undefined,
): Record<string, Buffer> {
  if (raw == null || raw.trim() === '') {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FILE_NAME_ENC_KEYS_JSON must be valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FILE_NAME_ENC_KEYS_JSON must be a JSON object');
  }

  const keys: Record<string, Buffer> = {};
  for (const [version, value] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `FILE_NAME_ENC_KEYS_JSON.${version} must be a 32-byte hex or base64 key`,
      );
    }
    keys[version] = decodeAes256Key(value, version);
  }
  return keys;
}

function decodeAes256Key(raw: string, version: string): Buffer {
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) {
    throw new Error(
      `FILE_NAME_ENC_KEYS_JSON.${version} must decode to 32 bytes`,
    );
  }
  return decoded;
}
