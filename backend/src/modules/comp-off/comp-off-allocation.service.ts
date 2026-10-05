import { ConflictException, Injectable } from '@nestjs/common';
import {
  CompOffAllocationStatus,
  CompOffCreditStatus,
  Prisma,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CompOffAllocationService {
  /**
   * FIFO reserve by earliest expiry for a leave request.
   */
  async reserveForLeaveRequest(params: {
    tx: PrismaTx;
    companyId: string;
    branchId: string;
    employeeId: string;
    leaveTypeId: string;
    leaveRequestId: string;
    requestedDays: number;
    asOfDate: Date;
  }) {
    const existing = await params.tx.compOffAllocation.findMany({
      where: {
        leaveRequestId: params.leaveRequestId,
        status: CompOffAllocationStatus.RESERVED,
      },
    });
    if (existing.length > 0) {
      return existing;
    }

    const asOf = new Date(
      Date.UTC(
        params.asOfDate.getUTCFullYear(),
        params.asOfDate.getUTCMonth(),
        params.asOfDate.getUTCDate(),
      ),
    );

    const credits = await params.tx.compOffCredit.findMany({
      where: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        status: {
          in: [CompOffCreditStatus.AVAILABLE, CompOffCreditStatus.RESERVED],
        },
        availableDays: { gt: 0 },
        expiresOn: { gte: asOf },
      },
      orderBy: [{ expiresOn: 'asc' }, { createdAt: 'asc' }],
    });

    let remaining = params.requestedDays;
    const created: Array<{ id: string }> = [];

    for (const credit of credits) {
      if (remaining <= 0) break;

      const available = Number(credit.availableDays);
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      const nextAvailable = Number((available - take).toFixed(2));
      const nextReserved = Number(
        (Number(credit.reservedDays) + take).toFixed(2),
      );

      const updated = await params.tx.compOffCredit.updateMany({
        where: {
          id: credit.id,
          availableDays: credit.availableDays,
          status: {
            in: [CompOffCreditStatus.AVAILABLE, CompOffCreditStatus.RESERVED],
          },
        },
        data: {
          availableDays: nextAvailable,
          reservedDays: nextReserved,
          status:
            nextAvailable === 0 && Number(credit.usedDays) === 0
              ? CompOffCreditStatus.RESERVED
              : nextAvailable > 0
                ? CompOffCreditStatus.AVAILABLE
                : CompOffCreditStatus.RESERVED,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Comp-off credit changed during reservation',
        });
      }

      const allocation = await params.tx.compOffAllocation.create({
        data: {
          companyId: params.companyId,
          branchId: params.branchId,
          employeeId: params.employeeId,
          compOffCreditId: credit.id,
          leaveRequestId: params.leaveRequestId,
          allocatedDays: take,
          status: CompOffAllocationStatus.RESERVED,
          reservedAt: new Date(),
        },
      });
      created.push(allocation);
      remaining = Number((remaining - take).toFixed(2));
    }

    if (remaining > 0) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.COMP_OFF_BALANCE_INSUFFICIENT,
        message: 'Insufficient Comp-off credit for this leave request',
      });
    }

    return created;
  }

  async consumeForLeaveRequest(params: {
    tx: PrismaTx;
    leaveRequestId: string;
  }) {
    const allocations = await params.tx.compOffAllocation.findMany({
      where: {
        leaveRequestId: params.leaveRequestId,
        status: CompOffAllocationStatus.RESERVED,
      },
    });

    for (const allocation of allocations) {
      const credit = await params.tx.compOffCredit.findUniqueOrThrow({
        where: { id: allocation.compOffCreditId },
      });
      const days = Number(allocation.allocatedDays);
      const nextReserved = Number(
        (Number(credit.reservedDays) - days).toFixed(2),
      );
      const nextUsed = Number((Number(credit.usedDays) + days).toFixed(2));

      const updated = await params.tx.compOffCredit.updateMany({
        where: {
          id: credit.id,
          reservedDays: credit.reservedDays,
        },
        data: {
          reservedDays: Math.max(0, nextReserved),
          usedDays: nextUsed,
          status:
            Number(credit.availableDays) === 0 && nextReserved <= 0
              ? CompOffCreditStatus.USED
              : Number(credit.availableDays) > 0
                ? CompOffCreditStatus.AVAILABLE
                : CompOffCreditStatus.RESERVED,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Comp-off credit changed during consumption',
        });
      }

      await params.tx.compOffAllocation.update({
        where: { id: allocation.id },
        data: {
          status: CompOffAllocationStatus.CONSUMED,
          consumedAt: new Date(),
        },
      });
    }
  }

  async releaseForLeaveRequest(params: {
    tx: PrismaTx;
    leaveRequestId: string;
    /** When restoring after approved cancel, expired credits are not restored. */
    restoreConsumed?: boolean;
    asOfDate?: Date;
  }) {
    const statuses: CompOffAllocationStatus[] = params.restoreConsumed
      ? [CompOffAllocationStatus.CONSUMED]
      : [CompOffAllocationStatus.RESERVED];

    const allocations = await params.tx.compOffAllocation.findMany({
      where: {
        leaveRequestId: params.leaveRequestId,
        status: { in: statuses },
      },
    });

    const asOf = params.asOfDate
      ? new Date(
          Date.UTC(
            params.asOfDate.getUTCFullYear(),
            params.asOfDate.getUTCMonth(),
            params.asOfDate.getUTCDate(),
          ),
        )
      : null;

    for (const allocation of allocations) {
      const credit = await params.tx.compOffCredit.findUniqueOrThrow({
        where: { id: allocation.compOffCreditId },
      });
      const days = Number(allocation.allocatedDays);

      if (
        credit.status === CompOffCreditStatus.REVOKED ||
        credit.status === CompOffCreditStatus.EXPIRED
      ) {
        await params.tx.compOffAllocation.update({
          where: { id: allocation.id },
          data: {
            status: CompOffAllocationStatus.RELEASED,
            releasedAt: new Date(),
          },
        });
        continue;
      }

      if (params.restoreConsumed) {
        // Approved leave cancellation restores only unexpired credits.
        if (asOf && credit.expiresOn < asOf) {
          await params.tx.compOffAllocation.update({
            where: { id: allocation.id },
            data: {
              status: CompOffAllocationStatus.RELEASED,
              releasedAt: new Date(),
            },
          });
          continue;
        }

        const nextUsed = Number((Number(credit.usedDays) - days).toFixed(2));
        const nextAvailable = Number(
          (Number(credit.availableDays) + days).toFixed(2),
        );
        await params.tx.compOffCredit.update({
          where: { id: credit.id },
          data: {
            usedDays: Math.max(0, nextUsed),
            availableDays: nextAvailable,
            status: CompOffCreditStatus.AVAILABLE,
          },
        });
      } else {
        const nextReserved = Number(
          (Number(credit.reservedDays) - days).toFixed(2),
        );
        const nextAvailable = Number(
          (Number(credit.availableDays) + days).toFixed(2),
        );
        await params.tx.compOffCredit.update({
          where: { id: credit.id },
          data: {
            reservedDays: Math.max(0, nextReserved),
            availableDays: nextAvailable,
            status: CompOffCreditStatus.AVAILABLE,
          },
        });
      }

      await params.tx.compOffAllocation.update({
        where: { id: allocation.id },
        data: {
          status: CompOffAllocationStatus.RELEASED,
          releasedAt: new Date(),
        },
      });
    }
  }
}
