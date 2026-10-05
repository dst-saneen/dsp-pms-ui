import { randomBytes } from 'node:crypto';

import { QA_STAGING_TARGET } from '../assert-destructive-db-guard';

export type QaRunRecord = {
  entityType: string;
  id: string;
  companyId: string | null;
  cleanupOrder: number;
  createdAt: string;
};

export type QaRunManifest = {
  manifestVersion: 1;
  runId: string;
  suite: string;
  createdAt: string;
  target: {
    databaseName: string;
    databaseSchema: string;
  };
  gitCommit: string;
  contractFingerprint: string;
  schemaFingerprintBefore: string | null;
  schemaFingerprintAfter: string | null;
  createdRecords: QaRunRecord[];
  cleanup: {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
    completedAt: string | null;
  };
};

const RUN_ID_PATTERN = /^QA-[A-Z0-9][A-Z0-9-]{0,30}-\d{8}T\d{6}Z-[a-f0-9]{8}$/;

function utcCompactTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function createQaRunId(suite: string, now = new Date()): string {
  const normalizedSuite = suite
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 31);
  if (!normalizedSuite) {
    throw new Error('QA suite must contain at least one letter or digit.');
  }
  return `QA-${normalizedSuite}-${utcCompactTimestamp(now)}-${randomBytes(4).toString('hex')}`;
}

export function createQaRunManifest(input: {
  suite: string;
  gitCommit: string;
  contractFingerprint: string;
  now?: Date;
}): QaRunManifest {
  const now = input.now ?? new Date();
  const manifest: QaRunManifest = {
    manifestVersion: 1,
    runId: createQaRunId(input.suite, now),
    suite: input.suite.trim(),
    createdAt: now.toISOString(),
    target: {
      databaseName: QA_STAGING_TARGET.databaseName,
      databaseSchema: QA_STAGING_TARGET.databaseSchema,
    },
    gitCommit: input.gitCommit.trim(),
    contractFingerprint: input.contractFingerprint,
    schemaFingerprintBefore: null,
    schemaFingerprintAfter: null,
    createdRecords: [],
    cleanup: { status: 'NOT_STARTED', completedAt: null },
  };
  validateQaRunManifest(manifest);
  return manifest;
}

export function recordCreatedEntity(
  manifest: QaRunManifest,
  record: Omit<QaRunRecord, 'createdAt'> & { createdAt?: string },
): void {
  const normalized: QaRunRecord = {
    ...record,
    entityType: record.entityType.trim(),
    id: record.id.trim(),
    companyId: record.companyId?.trim() || null,
    createdAt: record.createdAt ?? new Date().toISOString(),
  };
  if (!normalized.entityType || !normalized.id) {
    throw new Error(
      'Every run-owned record requires an entityType and exact id.',
    );
  }
  if (
    !Number.isInteger(normalized.cleanupOrder) ||
    normalized.cleanupOrder < 0
  ) {
    throw new Error('cleanupOrder must be a non-negative integer.');
  }
  if (
    manifest.createdRecords.some(
      (item) =>
        item.entityType === normalized.entityType && item.id === normalized.id,
    )
  ) {
    throw new Error(
      `Run manifest already contains ${normalized.entityType}/${normalized.id}.`,
    );
  }
  manifest.createdRecords.push(normalized);
}

export function cleanupRecordsInDependencyOrder(
  manifest: QaRunManifest,
): QaRunRecord[] {
  validateQaRunManifest(manifest);
  return [...manifest.createdRecords].sort(
    (left, right) =>
      right.cleanupOrder - left.cleanupOrder ||
      left.entityType.localeCompare(right.entityType) ||
      left.id.localeCompare(right.id),
  );
}

export function validateQaRunManifest(manifest: QaRunManifest): void {
  if (manifest.manifestVersion !== 1) {
    throw new Error('Unsupported QA run manifest version.');
  }
  if (!RUN_ID_PATTERN.test(manifest.runId)) {
    throw new Error('QA runId does not match the required run-owned format.');
  }
  if (
    manifest.target.databaseName !== QA_STAGING_TARGET.databaseName ||
    manifest.target.databaseSchema !== QA_STAGING_TARGET.databaseSchema
  ) {
    throw new Error(
      'QA run manifest does not target the approved staging schema.',
    );
  }
  if (!manifest.gitCommit || !manifest.contractFingerprint) {
    throw new Error(
      'QA run manifest requires a code and data-contract fingerprint.',
    );
  }

  const records = new Set<string>();
  for (const record of manifest.createdRecords) {
    if (!record.entityType.trim() || !record.id.trim()) {
      throw new Error('QA cleanup records must contain exact entity IDs.');
    }
    if (!Number.isInteger(record.cleanupOrder) || record.cleanupOrder < 0) {
      throw new Error('QA cleanupOrder must be a non-negative integer.');
    }
    const key = `${record.entityType}\u0000${record.id}`;
    if (records.has(key)) {
      throw new Error(
        `Duplicate QA cleanup record: ${record.entityType}/${record.id}.`,
      );
    }
    records.add(key);
  }
}
