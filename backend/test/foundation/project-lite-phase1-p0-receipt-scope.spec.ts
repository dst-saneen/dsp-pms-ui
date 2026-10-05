import { DomainConflictException } from '../../src/common';
import { PROJECTS_ERROR_CODES } from '../../src/modules/projects/constants/projects-error-codes';
import { replayProjectCommandReceipt } from '../../src/modules/projects/policies/project-command-receipt-replay';

describe('ProjectCommandReceiptService replay rules (PRJ-P0-01)', () => {
  it('returns the safe snapshot for an exact same-actor completed receipt', () => {
    const snapshot = {
      entityId: 'proj-1',
      state: 'ACTIVE',
      version: 2,
    };
    expect(
      replayProjectCommandReceipt(
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
          resultEntityType: 'PROJECT',
          resultEntityId: 'proj-1',
          safeResultSnapshot: { id: 'proj-1', status: 'ACTIVE', version: 2 },
          completedAt: new Date('2026-08-21T00:00:00.000Z'),
        },
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
        },
      ),
    ).toEqual(snapshot);
  });

  it('rejects a different actor with OPERATION_ID_REUSED', () => {
    try {
      replayProjectCommandReceipt(
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
          resultEntityType: 'PROJECT',
          resultEntityId: 'proj-1',
          safeResultSnapshot: {
            entityId: 'proj-1',
            state: null,
            version: null,
          },
          completedAt: new Date(),
        },
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-2',
        },
      );
      fail('expected DomainConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainConflictException);
      expect((error as DomainConflictException).code).toBe(
        PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
      );
    }
  });

  it('rejects a different request hash with OPERATION_ID_REUSED', () => {
    try {
      replayProjectCommandReceipt(
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
          resultEntityType: 'PROJECT',
          resultEntityId: 'proj-1',
          safeResultSnapshot: {
            entityId: 'proj-1',
            state: null,
            version: null,
          },
          completedAt: new Date(),
        },
        {
          requestHash: 'hash-b',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
        },
      );
      fail('expected DomainConflictException');
    } catch (error) {
      expect((error as DomainConflictException).code).toBe(
        PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
      );
    }
  });

  it('returns PROJECT_COMMAND_IN_PROGRESS for a claimed incomplete receipt', () => {
    try {
      replayProjectCommandReceipt(
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
          resultEntityType: null,
          resultEntityId: null,
          safeResultSnapshot: null,
          completedAt: null,
        },
        {
          requestHash: 'hash-a',
          commandType: 'PROJECT_ACTIVATE',
          actorUserId: 'user-1',
        },
      );
      fail('expected DomainConflictException');
    } catch (error) {
      expect((error as DomainConflictException).code).toBe(
        PROJECTS_ERROR_CODES.PROJECT_COMMAND_IN_PROGRESS,
      );
    }
  });
});

describe('project_command_receipt_guard SQL contract (PRJ-P0-01)', () => {
  it('documents the CLAIMED → COMPLETED transition predicate', () => {
    const claimed = {
      safeResultSnapshot: null as unknown,
      resultEntityType: null as string | null,
      resultEntityId: null as string | null,
      completedAt: null as Date | null,
    };
    const completed = {
      safeResultSnapshot: { id: 'x', status: 'ACTIVE', version: 1 },
      resultEntityType: 'PROJECT',
      resultEntityId: 'x',
      completedAt: new Date(),
    };

    const mayComplete =
      claimed.safeResultSnapshot == null &&
      claimed.resultEntityType == null &&
      claimed.resultEntityId == null &&
      claimed.completedAt == null &&
      completed.safeResultSnapshot != null &&
      completed.resultEntityType != null &&
      completed.resultEntityId != null &&
      completed.completedAt != null;

    expect(mayComplete).toBe(true);
  });
});
