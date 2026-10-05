import * as crypto from 'crypto';

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function timingSafeEqualText(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

export function hexSha256ToS3Checksum(hex: string): string {
  const normalized = hex
    .trim()
    .toLowerCase()
    .replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('Invalid SHA-256 hex digest');
  }
  return Buffer.from(normalized, 'hex').toString('base64');
}

export function s3ChecksumToHex(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) {
      return decoded.toString('hex');
    }
  } catch {
    return null;
  }
  return null;
}

export function hashPublicSessionToken(token: string): string {
  return sha256Hex(token);
}

export function newPublicSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function canonicalUploadRequestDigest(input: {
  purpose: string;
  jobOpeningId?: string | null;
  jobApplicationId?: string | null;
  employeeId?: string | null;
  jobOfferId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  applicationOperationId?: string | null;
  fileName: string;
  declaredMimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  operationId: string;
}): string {
  const canonical = [
    'v1',
    input.purpose,
    input.jobOpeningId ?? '',
    input.jobApplicationId ?? '',
    input.employeeId ?? '',
    input.jobOfferId ?? '',
    input.projectId ?? '',
    input.taskId ?? '',
    input.applicationOperationId ?? '',
    input.fileName,
    input.declaredMimeType,
    String(input.sizeBytes),
    input.checksumSha256.toLowerCase(),
    input.operationId,
  ].join('\n');
  return sha256Hex(canonical);
}

export function commandRequestDigest(
  commandType: string,
  payload: Record<string, unknown>,
): string {
  const canonical = JSON.stringify({
    v: 1,
    commandType,
    payload,
  });
  return sha256Hex(canonical);
}
