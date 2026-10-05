import { requestContextStorage } from '../../src/common';
import { EmployeeDomainScopeService } from '../../src/modules/auth/employee-domain-scope.service';

function withScope(
  scope: {
    isGlobal?: boolean;
    scopeLevel?: 'GLOBAL' | 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';
    activeCompanyGroupId?: string;
    activeCompanyId?: string;
    activeBranchId?: string;
  },
  fn: () => void,
) {
  requestContextStorage.run(
    {
      requestId: 'test-request',
      ...scope,
    },
    fn,
  );
}

describe('workforce tenant scope filters', () => {
  const prisma = {
    employee: {
      findFirst: jest.fn(),
    },
  } as never;
  const service = new EmployeeDomainScopeService(prisma);

  it('forces branch-scoped leave and attendance through employee branch', () => {
    withScope(
      {
        scopeLevel: 'BRANCH',
        activeCompanyGroupId: 'group-a',
        activeCompanyId: 'company-a',
        activeBranchId: 'branch-a',
      },
      () => {
        expect(service.attendanceWhere()).toEqual({
          employee: {
            companyId: 'company-a',
            branchId: 'branch-a',
          },
        });
        expect(service.leaveRequestWhere()).toEqual({
          companyId: 'company-a',
          employee: { branchId: 'branch-a' },
        });
        expect(service.leaveBalanceWhere()).toEqual({
          employee: {
            companyId: 'company-a',
            branchId: 'branch-a',
          },
        });
        expect(service.leavePolicyWhere()).toEqual({
          companyId: 'company-a',
          branchId: 'branch-a',
        });
      },
    );
  });

  it('does not let company-group filters widen beyond the active group', () => {
    withScope(
      {
        scopeLevel: 'COMPANY_GROUP',
        activeCompanyGroupId: 'group-a',
      },
      () => {
        expect(service.leaveTypeWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
        expect(service.holidayWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
      },
    );
  });
});
