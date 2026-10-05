import { Prisma } from '@prisma/client';

import type { PrismaTx } from '../workforce-approval/workforce-approval-resolver.service';

export function branchRosterLockKey(branchId: string): string {
  return `shift-roster:${branchId}`;
}

export async function acquireBranchRosterAdvisoryLock(
  tx: PrismaTx,
  branchId: string,
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${branchRosterLockKey(branchId)}, 0))`,
  );
}
