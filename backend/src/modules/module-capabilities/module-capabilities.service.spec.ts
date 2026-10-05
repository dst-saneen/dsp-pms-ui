import { CompanyModuleCode } from '@prisma/client';

import { ModuleCapabilitiesService } from './module-capabilities.service';
import { FINANCE_PERMISSIONS } from '../office-finance/policies/finance-permissions';
import { PAYROLL_PERMISSIONS } from '../payroll/policies/payroll-permissions';
import type { AuthenticatedUser } from '../auth/auth.types';

jest.mock('../../common', () => {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
  const actual = jest.requireActual('../../common');
  return {
    ...actual,
    getOrganizationScope: () => ({ activeCompanyId: 'company-1' }),
  };
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
});

const allModules = new Set<CompanyModuleCode>([
  CompanyModuleCode.ASSETS,
  CompanyModuleCode.DELIVERY,
  CompanyModuleCode.FILE_STORAGE,
  CompanyModuleCode.FINANCE,
  CompanyModuleCode.ONBOARDING,
  CompanyModuleCode.PAYROLL,
  CompanyModuleCode.PROJECTS,
  CompanyModuleCode.RECRUITMENT,
  CompanyModuleCode.RECRUITMENT_SHORTLIST,
]);

function createService(input?: {
  enabledModules?: Set<CompanyModuleCode>;
  workforceJobsEnabled?: boolean;
}) {
  const entitlements = {
    getEnabledModules: jest
      .fn()
      .mockResolvedValue(input?.enabledModules ?? allModules),
  };
  const config = {
    get: jest.fn().mockReturnValue(input?.workforceJobsEnabled ?? true),
  };

  return {
    service: new ModuleCapabilitiesService(
      entitlements as never,
      config as never,
    ),
    entitlements,
    config,
  };
}

const user = {
  id: 'user-1',
  username: 'maker',
  mustChangePassword: false,
  sessionId: 'session-1',
  authorization: {
    roles: [],
    permissions: [
      FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE,
      FINANCE_PERMISSIONS.SETTINGS_MANAGE,
      FINANCE_PERMISSIONS.REPORTS_READ,
      PAYROLL_PERMISSIONS.PAYROLL_MANAGE,
      PAYROLL_PERMISSIONS.PAYROLL_READ,
    ],
    scopeLevel: 'COMPANY',
    isGlobal: false,
    activeCompanyId: 'company-1',
    activeBranchId: 'branch-1',
    availableScopes: [],
  },
} as AuthenticatedUser;

describe('ModuleCapabilitiesService', () => {
  it('reads canonical module availability from CompanyModuleEntitlement', async () => {
    const { service, entitlements } = createService();

    const result = await service.getForUser(user);

    expect(entitlements.getEnabledModules).toHaveBeenCalledWith('company-1');
    expect(result).toMatchObject({
      projects: true,
      finance: true,
      payroll: true,
      payrollDependencyState: { ready: true, blockedReasons: [] },
    });
    expect(result).not.toHaveProperty('projectsLite');
    expect(result).not.toHaveProperty('officeFinanceLite');
    expect(result).not.toHaveProperty('payrollLite');
  });

  it('emits server collection actions for entitled modules', async () => {
    const { service } = createService();

    const result = await service.getForUser(user);

    expect(result.financeActions).toEqual(
      expect.arrayContaining([
        'CREATE_TRANSACTION',
        'MANAGE_SETUP',
        'CREATE_PERIOD',
        'EXPORT_REPORT',
      ]),
    );
    expect(result.payrollActions).toEqual(
      expect.arrayContaining([
        'CREATE_RUN',
        'MANAGE_COMPONENTS',
        'MANAGE_EMPLOYEE_INPUTS',
        'EXPORT_REGISTER',
      ]),
    );
  });

  it('fails closed for gated navigation without the corresponding permission', async () => {
    const { service } = createService();
    const result = await service.getForUser(user);

    expect(result.projectsNav).toBe(false);
    expect(result.onboardingNav).toBe(false);
    expect(result.assetsNav).toBe(false);
    expect(result.assetSelfNav).toBe(false);
    expect(result.deliveryOperationsNav).toBe(false);
    expect(result.fileOperationsNav).toBe(false);
    expect(result.recruitmentNav).toBe(false);
    expect(result.recruitmentShortlist).toBe(false);
  });

  it('exposes employee asset self-service when Assets is entitled and hr.self.read is present', async () => {
    const { service } = createService();
    const result = await service.getForUser({
      ...user,
      authorization: {
        ...user.authorization,
        permissions: ['hr.self.read', 'hr.self.manage'],
      },
    });

    expect(result.assetsNav).toBe(false);
    expect(result.assetSelfNav).toBe(true);
  });

  it('exposes delivery operations navigation for an entitled company with recruitment delivery read permission', async () => {
    const { service } = createService();
    const result = await service.getForUser({
      ...user,
      authorization: {
        ...user.authorization,
        permissions: [
          ...user.authorization.permissions,
          'hr.recruitment.delivery.read',
        ],
      },
    });

    expect(result.deliveryOperationsNav).toBe(true);
  });

  it('does not expose delivery operations navigation without the Delivery entitlement', async () => {
    const enabledModules = new Set(allModules);
    enabledModules.delete(CompanyModuleCode.DELIVERY);
    const { service } = createService({ enabledModules });
    const result = await service.getForUser({
      ...user,
      authorization: {
        ...user.authorization,
        permissions: [
          ...user.authorization.permissions,
          'platform.delivery.read',
        ],
      },
    });

    expect(result.deliveryOperationsNav).toBe(false);
  });

  it('exposes canonical navigation when both entitlement and permission allow it', async () => {
    const { service } = createService();
    const result = await service.getForUser({
      ...user,
      authorization: {
        ...user.authorization,
        permissions: [
          ...user.authorization.permissions,
          'hr.onboarding.read',
          'assets.assets.read',
          'projects.projects.read',
          'platform.delivery.read',
          'files.operations.read',
          'hr.recruitment.read',
        ],
      },
    });

    expect(result.onboardingNav).toBe(true);
    expect(result.assetsNav).toBe(true);
    expect(result.projectsNav).toBe(true);
    expect(result.deliveryOperationsNav).toBe(true);
    expect(result.fileOperationsNav).toBe(true);
    expect(result.recruitmentNav).toBe(true);
    expect(result.recruitmentShortlist).toBe(true);
  });

  it('does not hide payroll navigation when a worker dependency is degraded', async () => {
    const { service } = createService({ workforceJobsEnabled: false });
    const result = await service.getForUser(user);

    expect(result.payroll).toBe(true);
    expect(result.payrollNav).toBe(true);
    expect(result.payrollDependencyState).toEqual({
      ready: false,
      blockedReasons: ['PAYROLL_WORKFORCE_JOBS_NOT_ENABLED'],
    });
  });

  it('recognizes platform-wide authorization for entitled module navigation and actions', async () => {
    const { service } = createService();

    const result = await service.getForUser({
      ...user,
      authorization: {
        ...user.authorization,
        roles: ['SUPER_ADMINISTRATOR'],
        permissions: [],
        isGlobal: true,
      },
    });

    expect(result).toMatchObject({
      projectsNav: true,
      onboardingNav: true,
      assetsNav: true,
      assetSelfNav: true,
      deliveryOperationsNav: true,
      fileOperationsNav: true,
      recruitmentNav: true,
      recruitmentShortlist: true,
      financeNav: true,
      payrollNav: true,
    });
    expect(result.financeActions).toEqual([
      'CREATE_TRANSACTION',
      'MANAGE_SETUP',
      'CREATE_PERIOD',
      'EXPORT_REPORT',
    ]);
    expect(result.payrollActions).toEqual([
      'CREATE_RUN',
      'MANAGE_COMPONENTS',
      'MANAGE_EMPLOYEE_INPUTS',
      'EXPORT_REGISTER',
    ]);
  });

  it('denies all module capabilities when the Company has no enabled rows', async () => {
    const { service } = createService({ enabledModules: new Set() });
    const result = await service.getForUser({
      ...user,
      authorization: {
        ...user.authorization,
        permissions: [
          'hr.onboarding.read',
          'assets.assets.read',
          'projects.projects.read',
          'platform.delivery.read',
          'files.operations.read',
          'hr.recruitment.read',
          PAYROLL_PERMISSIONS.PAYROLL_READ,
        ],
      },
    });

    expect(result).toMatchObject({
      projects: false,
      finance: false,
      payroll: false,
      projectsNav: false,
      financeNav: false,
      payrollNav: false,
      onboardingNav: false,
      assetsNav: false,
      deliveryOperationsNav: false,
      fileOperationsNav: false,
      recruitmentNav: false,
      recruitmentShortlist: false,
    });
  });
});
