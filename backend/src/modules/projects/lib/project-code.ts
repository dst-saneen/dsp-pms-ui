/** Slug a display name into a stable uppercase code (spaces → underscores). */
export function normalizeProjectCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

/**
 * Build a unique code from an optional requested code or a display name.
 * When the caller did not supply a code, suffixes `_2`, `_3`, … are used on collision.
 */
export async function resolveUniqueProjectCode(input: {
  requestedCode: string | undefined;
  displayName: string;
  fallback: string;
  maxLength?: number;
  exists: (candidate: string) => Promise<boolean>;
}): Promise<string> {
  const maxLength = input.maxLength ?? 64;
  const baseSource = input.requestedCode?.trim() || input.displayName;
  let base = normalizeProjectCode(baseSource).slice(0, maxLength);
  if (!base) {
    base = input.fallback;
  }

  let candidate = base;
  let suffix = 2;
  while (await input.exists(candidate)) {
    if (input.requestedCode?.trim()) {
      throw new Error('CODE_EXISTS');
    }
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, Math.max(1, maxLength - suffixText.length))}${suffixText}`;
    suffix += 1;
    if (suffix > 999) {
      throw new Error('CODE_GENERATE_FAILED');
    }
  }

  return candidate;
}
