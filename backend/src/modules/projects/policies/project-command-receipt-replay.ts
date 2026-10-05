import { DomainConflictException } from '../../../common';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';

export type ProjectCommandReceiptReplayRow = {
  requestHash: string;
  commandType: string;
  actorUserId: string;
  resultEntityType: string | null;
  resultEntityId: string | null;
  safeResultSnapshot: unknown;
  completedAt?: Date | null;
};

export type ProjectCommandReceiptReplayExpected = {
  requestHash: string;
  commandType: string;
  actorUserId: string;
};

/**
 * The receipt is an idempotency record, not a second copy of the command
 * response. Keep it deliberately narrow so replays cannot expose remarks,
 * reasons, document metadata, or other mutable presentation data.
 */
export type ProjectCommandReceiptSafeSnapshot = {
  entityId: string;
  state: string | null;
  version: number | null;
};

export function toProjectCommandReceiptSafeSnapshot(input: {
  entityId: string;
  snapshot: unknown;
}): ProjectCommandReceiptSafeSnapshot {
  const snapshot =
    input.snapshot !== null &&
    typeof input.snapshot === 'object' &&
    !Array.isArray(input.snapshot)
      ? (input.snapshot as Record<string, unknown>)
      : {};
  const state = [snapshot.state, snapshot.status, snapshot.statusV2].find(
    (value): value is string => typeof value === 'string',
  );
  const version = snapshot.version;

  return {
    entityId: input.entityId,
    state: state ?? null,
    version:
      typeof version === 'number' && Number.isSafeInteger(version)
        ? version
        : null,
  };
}

/**
 * Actor-bound receipt replay rules (PRJ-P0-01).
 * Completed receipts return the safe snapshot; claimed incomplete receipts
 * surface PROJECT_COMMAND_IN_PROGRESS rather than OPERATION_ID_REUSED.
 */
export function replayProjectCommandReceipt<T>(
  existing: ProjectCommandReceiptReplayRow,
  expected: ProjectCommandReceiptReplayExpected,
): T {
  if (existing.actorUserId !== expected.actorUserId) {
    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
      'operationId was claimed by a different actor.',
    );
  }

  if (existing.commandType !== expected.commandType) {
    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
      'operationId was already used with a different command type.',
    );
  }

  if (existing.requestHash !== expected.requestHash) {
    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
      'operationId was already used with a different request.',
    );
  }

  const incomplete =
    existing.safeResultSnapshot == null ||
    existing.resultEntityType == null ||
    existing.resultEntityId == null ||
    existing.completedAt == null;

  if (incomplete) {
    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.PROJECT_COMMAND_IN_PROGRESS,
      'operationId is still in progress. Retry shortly.',
    );
  }

  return toProjectCommandReceiptSafeSnapshot({
    entityId: existing.resultEntityId!,
    snapshot: existing.safeResultSnapshot,
  }) as T;
}
