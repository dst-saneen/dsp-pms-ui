import type { Prisma } from '@prisma/client';

import { LeaveRequestStatus } from '../employee-leave/constants';

type LeaveLookupClient = {
  leaveRequest: {
    findFirst: (args: {
      where: Prisma.LeaveRequestWhereInput;
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

/**
 * Active APPROVED full-day leave covering a business date (UTC midnight).
 * Used by attendance finalizer and check-in — never infer leave from calendar events.
 */
export async function findApprovedFullDayLeaveCovering(
  client: LeaveLookupClient,
  employeeId: string,
  businessDateUtcMidnight: Date,
): Promise<{ id: string } | null> {
  return client.leaveRequest.findFirst({
    where: {
      employeeId,
      isActive: true,
      status: LeaveRequestStatus.APPROVED,
      isHalfDay: false,
      fromDate: { lte: businessDateUtcMidnight },
      toDate: { gte: businessDateUtcMidnight },
    },
    select: { id: true },
  });
}
