import { Prisma } from '@prisma/client';

export function leaveRequestLockKey(leaveRequestId: string): string {
  return `leave-request:${leaveRequestId}`;
}

export async function lockLeaveRequest(
  tx: Prisma.TransactionClient,
  leaveRequestId: string,
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${leaveRequestLockKey(leaveRequestId)}, 0))`,
  );
}
