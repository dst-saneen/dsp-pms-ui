import { FinanceCapabilityService } from './finance-capability.service';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FinanceSourceType, FinanceTransactionStatus } from '@prisma/client';

describe('FinanceCapabilityService', () => {
  const service = new FinanceCapabilityService();

  const baseContext = (
    permissions: string[],
    userId = 'user-maker',
  ): OfficeFinanceAccessContext => ({
    userId,
    permissions,
    activeCompanyId: 'company-1',
  });

  it('blocks self-approval on submitted transactions', () => {
    const actions = service.getTransactionAllowedActions(
      {
        id: 'txn-1',
        status: FinanceTransactionStatus.SUBMITTED,
        version: 1,
        createdByUserId: 'user-maker',
        submittedByUserId: 'user-maker',
        sourceType: FinanceSourceType.MANUAL,
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
      },
      baseContext(
        [
          FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE,
          FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE,
        ],
        'user-maker',
      ),
    );

    expect(actions).toContain('CANCEL');
    expect(actions).not.toContain('APPROVE');
  });

  it('allows a distinct approver to approve submitted transactions', () => {
    const actions = service.getTransactionAllowedActions(
      {
        id: 'txn-1',
        status: FinanceTransactionStatus.SUBMITTED,
        version: 1,
        createdByUserId: 'user-maker',
        submittedByUserId: 'user-maker',
        sourceType: FinanceSourceType.MANUAL,
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
      },
      baseContext([FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE], 'user-approver'),
    );

    expect(actions).toEqual(expect.arrayContaining(['APPROVE', 'RETURN']));
  });

  it('blocks the submitter from approving even if they did not create the draft', () => {
    const actions = service.getTransactionAllowedActions(
      {
        id: 'txn-1',
        status: FinanceTransactionStatus.SUBMITTED,
        version: 1,
        createdByUserId: 'user-creator',
        submittedByUserId: 'user-submitter',
        sourceType: FinanceSourceType.MANUAL,
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
      },
      baseContext([FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE], 'user-submitter'),
    );

    expect(actions).not.toContain('APPROVE');
  });

  it('hides all actions for payroll-sourced expenses', () => {
    const actions = service.getTransactionAllowedActions(
      {
        id: 'txn-payroll',
        status: FinanceTransactionStatus.APPROVED,
        version: 1,
        createdByUserId: 'user-maker',
        submittedByUserId: 'user-maker',
        sourceType: FinanceSourceType.PAYROLL_RUN,
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
      },
      baseContext([
        FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE,
        FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE,
        FINANCE_PERMISSIONS.TRANSACTIONS_REVERSE,
      ]),
    );

    expect(actions).toEqual([]);
  });

  it('requires reverse permission for approved manual reversals', () => {
    const withoutReverse = service.getTransactionAllowedActions(
      {
        id: 'txn-1',
        status: FinanceTransactionStatus.APPROVED,
        version: 1,
        createdByUserId: 'user-maker',
        submittedByUserId: 'user-maker',
        sourceType: FinanceSourceType.MANUAL,
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
      },
      baseContext([FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE]),
    );

    expect(withoutReverse).not.toContain('REVERSE');

    const withReverse = service.getTransactionAllowedActions(
      {
        id: 'txn-1',
        status: FinanceTransactionStatus.APPROVED,
        version: 1,
        createdByUserId: 'user-maker',
        submittedByUserId: 'user-maker',
        sourceType: FinanceSourceType.MANUAL,
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
      },
      baseContext([FINANCE_PERMISSIONS.TRANSACTIONS_REVERSE]),
    );

    expect(withReverse).toContain('REVERSE');
  });
});
