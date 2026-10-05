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

describe('EmployeeDomainScopeService', () => {
  const prisma = {} as never;
  const service = new EmployeeDomainScopeService(prisma);

  it('allows global scope without company filters', () => {
    withScope({ isGlobal: true, scopeLevel: 'GLOBAL' }, () => {
      expect(service.employeeWhere()).toEqual({});
      expect(service.onboardingWhere()).toEqual({});
      expect(service.documentWhere()).toEqual({ employee: {} });
      expect(service.assetWhere()).toEqual({});
    });
  });

  it('scopes company-group users to companies in the group', () => {
    withScope(
      {
        scopeLevel: 'COMPANY_GROUP',
        activeCompanyGroupId: 'group-a',
      },
      () => {
        expect(service.employeeWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
        expect(service.onboardingTemplateWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
        expect(service.documentCategoryWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
        expect(service.holidayWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
        expect(service.leaveRequestWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
        expect(service.leavePolicyWhere()).toEqual({
          company: { companyGroupId: 'group-a' },
        });
      },
    );
  });

  it('scopes company users to active company only', () => {
    withScope(
      {
        scopeLevel: 'COMPANY',
        activeCompanyGroupId: 'group-a',
        activeCompanyId: 'company-a',
      },
      () => {
        expect(service.employeeWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.onboardingWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.employeeAssetWhere()).toEqual({
          employee: { companyId: 'company-a' },
        });
        expect(service.attendanceWhere()).toEqual({
          employee: { companyId: 'company-a' },
        });
        expect(service.leaveRequestWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.leaveTypeWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.leavePolicyWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.holidayWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.shiftRosterWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.attendanceExceptionWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.overtimeRequestWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.compOffCreditWhere()).toEqual({
          companyId: 'company-a',
        });
        expect(service.attendancePolicyWhere()).toEqual({
          companyId: 'company-a',
        });
      },
    );
  });

  it('scopes branch users to active branch within company', () => {
    withScope(
      {
        scopeLevel: 'BRANCH',
        activeCompanyGroupId: 'group-a',
        activeCompanyId: 'company-a',
        activeBranchId: 'branch-a',
      },
      () => {
        expect(service.employeeWhere()).toEqual({
          companyId: 'company-a',
          branchId: 'branch-a',
        });
        expect(service.onboardingWhere()).toEqual({
          companyId: 'company-a',
          employee: { branchId: 'branch-a' },
        });
        expect(service.assetWhere()).toEqual({
          companyId: 'company-a',
          branchId: 'branch-a',
        });
        expect(service.shiftRosterWhere()).toEqual({
          companyId: 'company-a',
          branchId: 'branch-a',
        });
        expect(service.attendancePeriodWhere()).toEqual({
          companyId: 'company-a',
          branchId: 'branch-a',
        });
        expect(service.attendancePolicyWhere()).toEqual({
          companyId: 'company-a',
          OR: [{ branchId: 'branch-a' }, { branchId: null }],
        });
      },
    );
  });

  it('returns no-scope sentinel when company context is missing', () => {
    withScope({ scopeLevel: 'COMPANY' }, () => {
      expect(service.employeeWhere()).toEqual({ id: '__no_scope__' });
      expect(service.onboardingWhere()).toEqual({ id: '__no_scope__' });
      expect(service.departmentWhere()).toEqual({ id: '__no_scope__' });
      expect(service.designationWhere()).toEqual({ id: '__no_scope__' });
      expect(service.assetCategoryWhere()).toEqual({ id: '__no_scope__' });
      expect(service.assetTypeWhere()).toEqual({ id: '__no_scope__' });
    });
  });

  it('nests child-record filters through parent relations', () => {
    withScope(
      {
        scopeLevel: 'COMPANY',
        activeCompanyId: 'company-a',
      },
      () => {
        expect(service.onboardingTaskWhere()).toEqual({
          onboarding: { companyId: 'company-a' },
        });
        expect(service.onboardingTemplateVersionWhere()).toEqual({
          onboardingTemplate: { companyId: 'company-a' },
        });
        expect(service.onboardingTemplateTaskWhere()).toEqual({
          onboardingTemplate: { companyId: 'company-a' },
        });
        expect(service.documentWhere()).toEqual({
          employee: { companyId: 'company-a' },
        });
      },
    );
  });
});
