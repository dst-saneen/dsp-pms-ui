import { PayrollCapabilityService } from './payroll-capability.service';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import type { PayrollAccessContext } from '../payroll-access.types';
import { PayrollScopeService } from './payroll-scope.service';

describe('PayrollCapabilityService', () => {
  const scope = {
    mapRunStatus: (_status: string, statusEnum: string | null) =>
      statusEnum ?? 'DRAFT',
  } as unknown as PayrollScopeService;

  const service = new PayrollCapabilityService(scope);

  const context = (
    permissions: string[],
    userId = 'user-maker',
  ): PayrollAccessContext => ({
    userId,
    permissions,
    activeCompanyId: 'company-1',
  });

  it('blocks creator from approving a calculated run', () => {
    const actions = service.getRunAllowedActions(
      {
        id: 'run-1',
        status: 'CALCULATED',
        statusEnum: 'CALCULATED',
        version: 2,
        createdByUserId: 'user-maker',
        calculatedByUserId: 'user-maker',
        approvedByUserId: null,
      },
      context(
        [
          PAYROLL_PERMISSIONS.PAYROLL_MANAGE,
          PAYROLL_PERMISSIONS.PAYROLL_APPROVE,
          PAYROLL_PERMISSIONS.PAYROLL_READ,
        ],
        'user-maker',
      ),
    );

    expect(actions).toContain('RETURN_TO_DRAFT');
    expect(actions).not.toContain('APPROVE');
  });

  it('allows an independent approver to approve', () => {
    const actions = service.getRunAllowedActions(
      {
        id: 'run-1',
        status: 'CALCULATED',
        statusEnum: 'CALCULATED',
        version: 2,
        createdByUserId: 'user-maker',
        calculatedByUserId: 'user-maker',
        approvedByUserId: null,
      },
      context([PAYROLL_PERMISSIONS.PAYROLL_APPROVE], 'user-approver'),
    );

    expect(actions).toContain('APPROVE');
    expect(actions).not.toContain('CALCULATE');
  });

  it('exposes mark paid only after approval', () => {
    const actions = service.getRunAllowedActions(
      {
        id: 'run-1',
        status: 'APPROVED',
        statusEnum: 'APPROVED',
        version: 3,
        createdByUserId: 'user-maker',
        calculatedByUserId: 'user-maker',
        approvedByUserId: 'user-approver',
      },
      context([PAYROLL_PERMISSIONS.PAYROLL_APPROVE], 'user-approver'),
    );

    expect(actions).toContain('MARK_PAID');
  });
});
