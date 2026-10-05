import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveBalanceTransactionType, Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { EmployeeLeaveBalanceService } from './employee-leave-balance.service';
import { LeaveBalanceLedgerService } from './leave-balance-ledger.service';

describe('EmployeeLeaveBalanceService ledger writes', () => {
  const prisma = {
    leaveType: { findFirst: jest.fn() },
    employeeLeaveBalance: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const employeeDomainScope = {
    assertEmployeeInScope: jest.fn(),
    leaveTypeWhere: jest.fn().mockReturnValue({}),
    leaveBalanceWhere: jest.fn().mockReturnValue({}),
    employeeWhere: jest.fn().mockReturnValue({}),
  };
  const leaveBalanceLedger = {
    createGeneratedBalance: jest.fn(),
    adjustEntitlement: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

  const service = new EmployeeLeaveBalanceService(
    prisma as never,
    employeeDomainScope as never,
    leaveBalanceLedger as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'co-1',
      branchId: 'br-1',
    });
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'lt-1',
      companyId: 'co-1',
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    prisma.$executeRaw.mockResolvedValue(1);
  });

  it('creates a balance through the ledger with a reason', async () => {
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue(null);
    leaveBalanceLedger.createGeneratedBalance.mockResolvedValue({
      id: 'bal-1',
    });
    prisma.employeeLeaveBalance.findUniqueOrThrow.mockResolvedValue({
      id: 'bal-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      year: 2026,
      entitlement: 12,
      used: 0,
      pending: 0,
      balance: 12,
    });

    await service.create({
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      year: 2026,
      entitlement: 12,
      reason: 'Opening annual leave',
    });

    expect(leaveBalanceLedger.createGeneratedBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        annualEntitlement: 12,
        carryForward: 0,
        reason: 'Opening annual leave',
        employee: expect.objectContaining({
          id: 'emp-1',
          companyId: 'co-1',
          branchId: 'br-1',
        }) as object,
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      'EmployeeLeaveBalance',
      'bal-1',
      'CREATE',
      null,
      expect.objectContaining({ reason: 'Opening annual leave' }),
      expect.objectContaining({ tx: prisma }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('rejects a duplicate create before writing the ledger', async () => {
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({ id: 'bal-1' });

    await expect(
      service.create({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        year: 2026,
        entitlement: 12,
        reason: 'Opening annual leave',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(leaveBalanceLedger.createGeneratedBalance).not.toHaveBeenCalled();
  });

  it('adjusts entitlement through the ledger and does not rewrite used or pending', async () => {
    const existing = {
      id: 'bal-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      year: 2026,
      entitlement: 12,
      used: 2,
      pending: 1,
      balance: 9,
      isActive: true,
      employee: { companyId: 'co-1', branchId: 'br-1' },
      leaveType: { id: 'lt-1' },
    };
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue(existing);
    prisma.employeeLeaveBalance.findUniqueOrThrow.mockResolvedValue({
      ...existing,
      entitlement: 15,
      balance: 12,
    });

    await service.update('bal-1', {
      entitlement: 15,
      reason: 'Policy increase mid-year',
    });

    expect(leaveBalanceLedger.adjustEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        entitlementDelta: 3,
        balanceDelta: 3,
        reason: 'Policy increase mid-year',
        referenceType: 'LEAVE_BALANCE_ADJUSTMENT',
      }),
    );
    expect(prisma.employeeLeaveBalance.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      'EmployeeLeaveBalance',
      'bal-1',
      'UPDATE',
      expect.objectContaining({ entitlement: 12 }),
      expect.objectContaining({
        entitlement: 15,
        reason: 'Policy increase mid-year',
      }),
      expect.objectContaining({ tx: prisma }),
    );
  });

  it('rejects entitlement below used plus pending', async () => {
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      entitlement: 12,
      used: 8,
      pending: 2,
      balance: 2,
      isActive: true,
      employee: { companyId: 'co-1', branchId: 'br-1' },
    });

    await expect(
      service.update('bal-1', {
        entitlement: 5,
        reason: 'Cut entitlement too far',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.LEAVE_BALANCE_INSUFFICIENT,
      }) as unknown,
    });
    expect(leaveBalanceLedger.adjustEntitlement).not.toHaveBeenCalled();
  });

  it('deactivates with audit and does not rewrite ledger totals', async () => {
    const existing = {
      id: 'bal-1',
      entitlement: 12,
      used: 2,
      pending: 0,
      balance: 10,
      isActive: true,
    };
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue(existing);
    prisma.employeeLeaveBalance.update.mockResolvedValue({
      ...existing,
      isActive: false,
    });

    await service.remove('bal-1', { reason: 'Left the company' });

    expect(prisma.employeeLeaveBalance.update).toHaveBeenCalledWith({
      where: { id: 'bal-1' },
      data: { isActive: false },
      include: { employee: true, leaveType: true },
    });
    expect(leaveBalanceLedger.adjustEntitlement).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      'EmployeeLeaveBalance',
      'bal-1',
      'DELETE',
      expect.objectContaining({ isActive: true }),
      expect.objectContaining({ isActive: false, reason: 'Left the company' }),
      expect.objectContaining({ tx: prisma }),
    );
  });

  it('blocks deactivate while pending days remain', async () => {
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      pending: 1,
      isActive: true,
    });

    await expect(
      service.remove('bal-1', { reason: 'Close this row' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.employeeLeaveBalance.update).not.toHaveBeenCalled();
  });

  it('404s an out-of-scope balance before any write', async () => {
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue(null);

    await expect(
      service.update('bal-missing', {
        entitlement: 10,
        reason: 'Does not exist',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(leaveBalanceLedger.adjustEntitlement).not.toHaveBeenCalled();
  });
});

describe('LeaveBalanceLedgerService adjustEntitlement', () => {
  const service = new LeaveBalanceLedgerService();

  it('writes an ADJUSTMENT row and updates aggregates', async () => {
    const tx = {
      leaveBalanceTransaction: {
        create: jest.fn().mockResolvedValue({ id: 't1' }),
      },
      employeeLeaveBalance: {
        update: jest.fn().mockResolvedValue({ id: 'bal-1' }),
      },
    };

    const result = await service.adjustEntitlement({
      tx: tx as never,
      leaveBalance: {
        id: 'bal-1',
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        year: 2026,
        entitlement: 12,
        used: 2,
        pending: 1,
        balance: 9,
        employee: { companyId: 'co-1', branchId: 'br-1' },
      },
      effectiveDate: new Date('2026-08-12'),
      referenceType: 'LEAVE_BALANCE_ADJUSTMENT',
      referenceId: 'bal-1',
      idempotencyKey: 'LEAVE_BALANCE_ADJUST:bal-1:req-1',
      reason: 'Policy increase',
      entitlementDelta: 3,
      balanceDelta: 3,
    });

    expect(tx.leaveBalanceTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: LeaveBalanceTransactionType.ADJUSTMENT,
          entitlementDelta: 3,
          usedDelta: 0,
          pendingDelta: 0,
          entitlementAfter: 15,
          usedAfter: 2,
          pendingAfter: 1,
          balanceAfter: 12,
          reason: 'Policy increase',
        }) as object,
      }),
    );
    expect(result.entitlementAfter).toBe(15);
    expect(result.balanceAfter).toBe(12);
  });
});
