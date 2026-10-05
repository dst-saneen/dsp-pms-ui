import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompOffCreditStatus,
  LeaveBalanceTransactionType,
  LeaveTypeCategory,
  Prisma,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { WorkforcePolicyDefaults } from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { LeaveBalanceLedgerService } from '../employee-leave-balance/leave-balance-ledger.service';
import { OvertimePolicyResolverService } from '../workforce-policy/overtime-policy-resolver.service';
import { minutesToCompOffDays } from '../overtime-request/overtime-eligibility.util';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CompOffCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly overtimePolicyResolver: OvertimePolicyResolverService,
    private readonly leaveBalanceLedger: LeaveBalanceLedgerService,
  ) {}

  async findAll(filters: {
    employeeId?: string;
    status?: CompOffCreditStatus;
  }) {
    const where: Prisma.CompOffCreditWhereInput = {
      ...this.employeeDomainScope.compOffCreditWhere(),
    };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;

    return this.prisma.compOffCredit.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        overtimeRequest: true,
        leaveType: true,
      },
      orderBy: [{ expiresOn: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.compOffCredit.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.compOffCreditWhere(),
      },
      include: {
        overtimeRequest: true,
        leaveType: true,
        allocations: true,
        employee: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Comp-off credit not found');
    }
    return row;
  }

  async findMine(employeeId: string) {
    return this.prisma.compOffCredit.findMany({
      where: {
        employeeId,
        ...this.employeeDomainScope.compOffCreditWhere(),
      },
      include: { overtimeRequest: true, leaveType: true },
      orderBy: [{ expiresOn: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createFromOvertimeApproval(
    input: {
      overtimeRequestId: string;
      companyId: string;
      branchId: string;
      employeeId: string;
      sourceDate: Date;
      approvedMinutes: number;
      createdByUserId: string;
    },
    tx: PrismaTx,
  ) {
    const existing = await tx.compOffCredit.findUnique({
      where: { overtimeRequestId: input.overtimeRequestId },
    });
    if (existing) {
      return existing;
    }

    const policy = await this.overtimePolicyResolver.resolve({
      companyId: input.companyId,
      branchId: input.branchId,
      asOfDate: input.sourceDate,
    });

    const earnedDays = minutesToCompOffDays(
      input.approvedMinutes,
      policy.compOffHalfDayMinutes,
      policy.compOffFullDayMinutes,
      policy.maxCompOffDaysPerSource,
    );
    if (earnedDays <= 0) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.COMP_OFF_LIMIT_EXCEEDED,
        message: `Approved minutes are insufficient to create a Comp-off credit (need at least ${policy.compOffHalfDayMinutes} min for half day, or ${policy.compOffFullDayMinutes} min for full day). Choose Payroll pending, or approve enough minutes.`,
      });
    }

    const leaveType = await tx.leaveType.findFirst({
      where: {
        companyId: input.companyId,
        category: LeaveTypeCategory.COMP_OFF,
        isActive: true,
      },
    });
    if (!leaveType) {
      throw new NotFoundException('Active COMP_OFF leave type not found');
    }

    const expiresOn = this.addDays(
      input.sourceDate,
      policy.compOffExpiryDays || WorkforcePolicyDefaults.compOffExpiryDays,
    );

    const credit = await tx.compOffCredit.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        employeeId: input.employeeId,
        overtimeRequestId: input.overtimeRequestId,
        leaveTypeId: leaveType.id,
        sourceDate: input.sourceDate,
        earnedDays,
        availableDays: earnedDays,
        reservedDays: 0,
        usedDays: 0,
        expiresOn,
        status: CompOffCreditStatus.AVAILABLE,
      },
    });

    await this.accrueLeaveBalance({
      tx,
      employeeId: input.employeeId,
      leaveTypeId: leaveType.id,
      companyId: input.companyId,
      branchId: input.branchId,
      sourceDate: input.sourceDate,
      earnedDays,
      creditId: credit.id,
      createdByUserId: input.createdByUserId,
    });

    return credit;
  }

  async revoke(id: string, reason: string, actor: AuthenticatedUser) {
    if (!reason?.trim()) {
      throw new BadRequestException('Revoke reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const credit = await tx.compOffCredit.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.compOffCreditWhere(),
        },
        include: { employee: true },
      });
      if (!credit) {
        throw new NotFoundException('Comp-off credit not found');
      }

      if (
        credit.status !== CompOffCreditStatus.AVAILABLE ||
        Number(credit.reservedDays) > 0 ||
        Number(credit.usedDays) > 0
      ) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Only unused and unreserved Comp-off credit can be revoked',
        });
      }

      const available = Number(credit.availableDays);
      const transition = await tx.compOffCredit.updateMany({
        where: {
          id,
          status: CompOffCreditStatus.AVAILABLE,
          reservedDays: 0,
          usedDays: 0,
        },
        data: {
          status: CompOffCreditStatus.REVOKED,
          availableDays: 0,
          revokedAt: new Date(),
          revokedByUserId: actor.id,
          revokeReason: reason,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Comp-off credit state changed during revoke',
        });
      }

      if (available > 0) {
        await this.applyLeaveBalanceDelta({
          tx,
          employeeId: credit.employeeId,
          leaveTypeId: credit.leaveTypeId,
          companyId: credit.companyId,
          branchId: credit.branchId,
          sourceDate: credit.sourceDate,
          entitlementDelta: -available,
          balanceDelta: -available,
          transactionType: LeaveBalanceTransactionType.ADJUSTMENT,
          referenceType: 'COMP_OFF_REVOKE',
          referenceId: credit.id,
          idempotencyKey: `COMP_OFF_REVOKE:${credit.id}`,
          reason,
          createdByUserId: actor.id,
        });
      }

      const updated = await tx.compOffCredit.findUniqueOrThrow({
        where: { id },
      });
      await this.auditService.log(
        'CompOffCredit',
        updated.id,
        'REVOKE',
        { status: CompOffCreditStatus.AVAILABLE },
        { status: updated.status, reason },
        { tx },
      );
      return updated;
    });
  }

  /**
   * Hourly expiry evaluator — Branch-date aware via caller-provided asOfDate.
   * Idempotent: already expired credits are skipped.
   */
  async expireCredits(
    asOfDate: Date,
    branchId: string,
  ): Promise<{ expiredCount: number }> {
    const asOf = new Date(
      Date.UTC(
        asOfDate.getUTCFullYear(),
        asOfDate.getUTCMonth(),
        asOfDate.getUTCDate(),
      ),
    );

    const candidates = await this.prisma.compOffCredit.findMany({
      where: {
        branchId,
        status: {
          in: [CompOffCreditStatus.AVAILABLE, CompOffCreditStatus.RESERVED],
        },
        expiresOn: { lt: asOf },
        availableDays: { gt: 0 },
      },
      take: 200,
    });

    let expiredCount = 0;
    for (const credit of candidates) {
      await this.prisma.$transaction(async (tx) => {
        const available = Number(credit.availableDays);
        if (available <= 0) {
          return;
        }

        const reserved = Number(credit.reservedDays);
        const used = Number(credit.usedDays);
        const nextStatus =
          reserved > 0
            ? CompOffCreditStatus.RESERVED
            : used > 0
              ? CompOffCreditStatus.USED
              : CompOffCreditStatus.EXPIRED;

        const result = await tx.compOffCredit.updateMany({
          where: {
            id: credit.id,
            status: {
              in: [CompOffCreditStatus.AVAILABLE, CompOffCreditStatus.RESERVED],
            },
            availableDays: { gt: 0 },
          },
          data: {
            availableDays: 0,
            status:
              nextStatus === CompOffCreditStatus.RESERVED
                ? CompOffCreditStatus.RESERVED
                : reserved === 0 && used === 0
                  ? CompOffCreditStatus.EXPIRED
                  : used > 0 && reserved === 0
                    ? CompOffCreditStatus.USED
                    : CompOffCreditStatus.RESERVED,
          },
        });
        if (result.count !== 1) {
          return;
        }

        // If fully unused, mark EXPIRED explicitly.
        if (reserved === 0 && used === 0) {
          await tx.compOffCredit.update({
            where: { id: credit.id },
            data: { status: CompOffCreditStatus.EXPIRED },
          });
        }

        await this.applyLeaveBalanceDelta({
          tx,
          employeeId: credit.employeeId,
          leaveTypeId: credit.leaveTypeId,
          companyId: credit.companyId,
          branchId: credit.branchId,
          sourceDate: credit.expiresOn,
          entitlementDelta: -available,
          balanceDelta: -available,
          transactionType: LeaveBalanceTransactionType.EXPIRY,
          referenceType: 'COMP_OFF_EXPIRY',
          referenceId: credit.id,
          idempotencyKey: `COMP_OFF_EXPIRY:${credit.id}:${asOf.toISOString().slice(0, 10)}`,
          reason: 'Comp-off credit expired',
        });
        expiredCount += 1;
      });
    }

    return { expiredCount };
  }

  private async accrueLeaveBalance(params: {
    tx: PrismaTx;
    employeeId: string;
    leaveTypeId: string;
    companyId: string;
    branchId: string;
    sourceDate: Date;
    earnedDays: number;
    creditId: string;
    createdByUserId: string;
  }) {
    const year = params.sourceDate.getUTCFullYear();
    let balance = await params.tx.employeeLeaveBalance.findFirst({
      where: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        year,
        isActive: true,
      },
    });

    if (!balance) {
      balance = await params.tx.employeeLeaveBalance.create({
        data: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year,
          entitlement: 0,
          used: 0,
          pending: 0,
          balance: 0,
        },
      });
    }

    await this.leaveBalanceLedger.write({
      tx: params.tx,
      leaveBalance: {
        ...balance,
        employee: {
          companyId: params.companyId,
          branchId: params.branchId,
        },
      },
      transactionType: LeaveBalanceTransactionType.ACCRUAL,
      effectiveDate: params.sourceDate,
      referenceType: 'COMP_OFF_ACCRUAL',
      referenceId: params.creditId,
      idempotencyKey: `COMP_OFF_ACCRUAL:${params.creditId}`,
      entitlementDelta: params.earnedDays,
      balanceDelta: params.earnedDays,
      createdByUserId: params.createdByUserId,
    });
  }

  private async applyLeaveBalanceDelta(params: {
    tx: PrismaTx;
    employeeId: string;
    leaveTypeId: string;
    companyId: string;
    branchId: string;
    sourceDate: Date;
    entitlementDelta: number;
    balanceDelta: number;
    usedDelta?: number;
    pendingDelta?: number;
    transactionType: LeaveBalanceTransactionType;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    reason?: string;
    createdByUserId?: string;
  }) {
    const year = params.sourceDate.getUTCFullYear();
    const balance = await params.tx.employeeLeaveBalance.findFirst({
      where: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        year,
        isActive: true,
      },
    });
    if (!balance) {
      return;
    }

    const entitlementAfter =
      Number(balance.entitlement) + params.entitlementDelta;
    const usedAfter = Number(balance.used) + (params.usedDelta ?? 0);
    const pendingAfter = Number(balance.pending) + (params.pendingDelta ?? 0);
    const balanceAfter = Number(balance.balance) + params.balanceDelta;

    try {
      await params.tx.leaveBalanceTransaction.create({
        data: {
          companyId: params.companyId,
          branchId: params.branchId,
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          leaveBalanceId: balance.id,
          transactionType: params.transactionType,
          entitlementDelta: params.entitlementDelta,
          usedDelta: params.usedDelta ?? 0,
          pendingDelta: params.pendingDelta ?? 0,
          balanceDelta: params.balanceDelta,
          entitlementAfter,
          usedAfter,
          pendingAfter,
          balanceAfter,
          effectiveDate: params.sourceDate,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          reason: params.reason ?? null,
          createdByUserId: params.createdByUserId ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }

    await params.tx.employeeLeaveBalance.update({
      where: { id: balance.id },
      data: {
        entitlement: entitlementAfter,
        used: usedAfter,
        pending: pendingAfter,
        balance: balanceAfter,
      },
    });
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
