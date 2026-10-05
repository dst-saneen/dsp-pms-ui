/**
 * Pure parent-chain cycle detection for Project tasks.
 * `parentById` maps taskId → parentTaskId (null = root).
 */
export type ParentCycleReason = 'SELF' | 'CYCLE';

export function detectParentCycle(args: {
  selfTaskId: string | null;
  proposedParentId: string;
  parentById: ReadonlyMap<string, string | null>;
}): ParentCycleReason | null {
  const { selfTaskId, proposedParentId, parentById } = args;

  if (selfTaskId && proposedParentId === selfTaskId) {
    return 'SELF';
  }

  let cursor: string | null = proposedParentId;
  const seen = new Set<string>();

  while (cursor) {
    if (selfTaskId && cursor === selfTaskId) {
      return 'CYCLE';
    }
    if (seen.has(cursor)) {
      return 'CYCLE';
    }
    seen.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }

  return null;
}
