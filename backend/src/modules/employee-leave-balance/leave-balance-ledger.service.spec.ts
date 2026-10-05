import { LeaveBalanceTransactionType } from '@prisma/client';

import { LeaveBalanceLedgerService } from './leave-balance-ledger.service';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('LeaveBalanceLedgerService', () => {
  const service = new LeaveBalanceLedgerService();

  it('writes reservation and reconciles aggregate after values', async () => {
    const tx = {
      leaveBalanceTransaction: {
        create: jest.fn().mockResolvedValue({ id: 't1' }),
      },
      employeeLeaveBalance: {
        update: jest.fn().mockResolvedValue({ id: 'bal-1' }),
      },
    };

    const result = await service.reserveRequest({
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
      effectiveDate: new Date('2026-08-03'),
      referenceType: 'LEAVE_REQUEST_SUBMIT',
      referenceId: 'lr-1',
      leaveRequestId: 'lr-1',
      idempotencyKey: 'LEAVE_REQUEST:lr-1:RESERVATION',
      pendingDelta: 1,
      balanceDelta: -1,
    });

    expect(tx.leaveBalanceTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: LeaveBalanceTransactionType.RESERVATION,
          entitlementAfter: 12,
          usedAfter: 2,
          pendingAfter: 2,
          balanceAfter: 8,
        }),
      }),
    );
    expect(tx.employeeLeaveBalance.update).toHaveBeenCalledWith({
      where: { id: 'bal-1' },
      data: {
        entitlement: 12,
        used: 2,
        pending: 2,
        balance: 8,
      },
    });
    expect(result.balanceAfter).toBe(8);
  });
});
