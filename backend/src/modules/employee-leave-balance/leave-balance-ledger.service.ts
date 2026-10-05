import { Injectable } from '@nestjs/common';
import { LeaveBalanceTransactionType, Prisma } from '@prisma/client';

type PrismaTx = Prisma.TransactionClient;

interface LedgerMutationInput {
  tx: PrismaTx;
  leaveBalance: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    entitlement: Prisma.Decimal | number;
    used: Prisma.Decimal | number;
    pending: Prisma.Decimal | number;
    balance: Prisma.Decimal | number;
    employee?: {
      companyId: string;
      branchId: string;
    } | null;
  };
  transactionType: LeaveBalanceTransactionType;
  effectiveDate: Date;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  reason?: string | null;
  leaveRequestId?: string | null;
  createdByUserId?: string | null;
  entitlementDelta?: number;
  usedDelta?: number;
  pendingDelta?: number;
  balanceDelta?: number;
}

interface CreateGeneratedBalanceInput {
  tx: PrismaTx;
  employee: {
    id: string;
    companyId: string;
    branchId: string;
  };
  leaveTypeId: string;
  year: number;
  annualEntitlement: number;
  carryForward: number;
  createdByUserId?: string | null;
  reason?: string | null;
}

@Injectable()
export class LeaveBalanceLedgerService {
  async createGeneratedBalance(
    input: CreateGeneratedBalanceInput,
  ): Promise<{ id: string }> {
    const totalEntitlement = input.annualEntitlement + input.carryForward;
    const leaveBalance = await input.tx.employeeLeaveBalance.create({
      data: {
        employeeId: input.employee.id,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
        entitlement: totalEntitlement,
        used: 0,
        pending: 0,
        balance: totalEntitlement,
      },
    });

    const hydrated = {
      ...leaveBalance,
      employee: {
        companyId: input.employee.companyId,
        branchId: input.employee.branchId,
      },
    };

    const effectiveDate = new Date(`${input.year}-01-01T00:00:00.000Z`);

    if (input.carryForward > 0) {
      await this.append({
        tx: input.tx,
        leaveBalance: {
          ...hydrated,
          entitlement: 0,
          used: 0,
          pending: 0,
          balance: 0,
        },
        transactionType: LeaveBalanceTransactionType.CARRY_FORWARD,
        effectiveDate,
        referenceType: 'LEAVE_BALANCE_GENERATION',
        referenceId: leaveBalance.id,
        idempotencyKey: `CARRY_FORWARD:${leaveBalance.id}:${input.year}`,
        entitlementDelta: input.carryForward,
        balanceDelta: input.carryForward,
        createdByUserId: input.createdByUserId ?? null,
        reason: input.reason ?? null,
      });
    }

    await this.append({
      tx: input.tx,
      leaveBalance: {
        ...hydrated,
        entitlement: input.carryForward,
        used: 0,
        pending: 0,
        balance: input.carryForward,
      },
      transactionType: LeaveBalanceTransactionType.ENTITLEMENT,
      effectiveDate,
      referenceType: 'LEAVE_BALANCE_GENERATION',
      referenceId: leaveBalance.id,
      idempotencyKey: `ENTITLEMENT:${leaveBalance.id}:${input.year}`,
      entitlementDelta: input.annualEntitlement,
      balanceDelta: input.annualEntitlement,
      createdByUserId: input.createdByUserId ?? null,
      reason: input.reason ?? null,
    });

    return leaveBalance;
  }

  async reserveRequest(input: Omit<LedgerMutationInput, 'transactionType'>) {
    return this.append({
      ...input,
      transactionType: LeaveBalanceTransactionType.RESERVATION,
      pendingDelta: Number(input.pendingDelta ?? 0),
      balanceDelta: Number(input.balanceDelta ?? 0),
    });
  }

  async consumeReservation(
    input: Omit<LedgerMutationInput, 'transactionType'>,
  ) {
    return this.append({
      ...input,
      transactionType: LeaveBalanceTransactionType.CONSUMPTION,
      usedDelta: Number(input.usedDelta ?? 0),
      pendingDelta: Number(input.pendingDelta ?? 0),
      balanceDelta: Number(input.balanceDelta ?? 0),
    });
  }

  async reverseRequest(input: Omit<LedgerMutationInput, 'transactionType'>) {
    return this.append({
      ...input,
      transactionType: LeaveBalanceTransactionType.REVERSAL,
      entitlementDelta: Number(input.entitlementDelta ?? 0),
      usedDelta: Number(input.usedDelta ?? 0),
      pendingDelta: Number(input.pendingDelta ?? 0),
      balanceDelta: Number(input.balanceDelta ?? 0),
    });
  }

  async adjustEntitlement(
    input: Omit<LedgerMutationInput, 'transactionType'> & {
      entitlementDelta: number;
    },
  ) {
    return this.append({
      ...input,
      transactionType: LeaveBalanceTransactionType.ADJUSTMENT,
      entitlementDelta: Number(input.entitlementDelta),
      balanceDelta: Number(input.balanceDelta ?? input.entitlementDelta),
    });
  }

  async write(input: LedgerMutationInput) {
    return this.append(input);
  }

  private async append(input: LedgerMutationInput) {
    const entitlementBefore = Number(input.leaveBalance.entitlement);
    const usedBefore = Number(input.leaveBalance.used);
    const pendingBefore = Number(input.leaveBalance.pending);
    const balanceBefore = Number(input.leaveBalance.balance);

    const entitlementAfter =
      entitlementBefore + Number(input.entitlementDelta ?? 0);
    const usedAfter = usedBefore + Number(input.usedDelta ?? 0);
    const pendingAfter = pendingBefore + Number(input.pendingDelta ?? 0);
    const balanceAfter = balanceBefore + Number(input.balanceDelta ?? 0);

    await input.tx.leaveBalanceTransaction.create({
      data: {
        companyId: input.leaveBalance.employee!.companyId,
        branchId: input.leaveBalance.employee!.branchId,
        employeeId: input.leaveBalance.employeeId,
        leaveTypeId: input.leaveBalance.leaveTypeId,
        leaveBalanceId: input.leaveBalance.id,
        leaveRequestId: input.leaveRequestId ?? null,
        transactionType: input.transactionType,
        entitlementDelta: Number(input.entitlementDelta ?? 0),
        usedDelta: Number(input.usedDelta ?? 0),
        pendingDelta: Number(input.pendingDelta ?? 0),
        balanceDelta: Number(input.balanceDelta ?? 0),
        entitlementAfter,
        usedAfter,
        pendingAfter,
        balanceAfter,
        effectiveDate: input.effectiveDate,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    await input.tx.employeeLeaveBalance.update({
      where: { id: input.leaveBalance.id },
      data: {
        entitlement: entitlementAfter,
        used: usedAfter,
        pending: pendingAfter,
        balance: balanceAfter,
      },
    });

    const reconciled = entitlementAfter - usedAfter - pendingAfter;
    if (Number(reconciled.toFixed(2)) !== Number(balanceAfter.toFixed(2))) {
      throw new Error(
        `Leave ledger mismatch for balance ${input.leaveBalance.id}`,
      );
    }

    return {
      entitlementAfter,
      usedAfter,
      pendingAfter,
      balanceAfter,
    };
  }
}
