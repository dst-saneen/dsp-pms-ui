import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyModuleCode } from '@prisma/client';

import { getOrganizationScope } from '../../common';
import type { Environment } from '../../config';

import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ASSET_INVENTORY_READ_PERMISSIONS,
  ASSET_CUSTODY_READ_PERMISSIONS,
} from '../asset-domain/policies/asset-permissions';
import { FINANCE_PERMISSIONS } from '../office-finance/policies/finance-permissions';
import { ONBOARDING_PERMISSIONS } from '../onboarding-runtime/constants/onboarding-permissions';
import { PAYROLL_PERMISSIONS } from '../payroll/policies/payroll-permissions';

import { CompanyModuleEntitlementService } from './company-module-entitlement.service';

export type FinanceCollectionAction =
  'CREATE_TRANSACTION' | 'MANAGE_SETUP' | 'CREATE_PERIOD' | 'EXPORT_REPORT';

export type PayrollCollectionAction =
  | 'CREATE_RUN'
  | 'MANAGE_COMPONENTS'
  | 'MANAGE_EMPLOYEE_INPUTS'
  | 'EXPORT_REGISTER';

/**
 * Company-scoped module capability contract for authenticated clients.
 * Product availability is always read from CompanyModuleEntitlement; config is
 * used only for true infrastructure readiness such as the workforce worker.
 */
export interface ModuleCapabilitiesResponse {
  projects: boolean;
  finance: boolean;
  payroll: boolean;
  projectsNav?: boolean;
  financeNav?: boolean;
  payrollNav?: boolean;
  onboardingNav?: boolean;
  assetsNav?: boolean;
  /** Employee self-service assets card on My Workspace (hr.self.read). */
  assetSelfNav?: boolean;
  deliveryOperationsNav?: boolean;
  fileOperationsNav?: boolean;
  recruitmentNav?: boolean;
  recruitmentShortlist?: boolean;
  financeActions?: FinanceCollectionAction[];
  payrollActions?: PayrollCollectionAction[];
  payrollDependencyState?: {
    ready: boolean;
    blockedReasons: string[];
  };
}

@Injectable()
export class ModuleCapabilitiesService {
  constructor(
    private readonly entitlements: CompanyModuleEntitlementService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async getForUser(
    user: AuthenticatedUser,
  ): Promise<ModuleCapabilitiesResponse> {
    const scope = getOrganizationScope();
    const companyId =
      scope.activeCompanyId ?? user.authorization.activeCompanyId ?? null;
    const enabledModules = await this.entitlements.getEnabledModules(companyId);

    const projects = enabledModules.has(CompanyModuleCode.PROJECTS);
    const finance = enabledModules.has(CompanyModuleCode.FINANCE);
    const payroll = enabledModules.has(CompanyModuleCode.PAYROLL);
    const onboarding = enabledModules.has(CompanyModuleCode.ONBOARDING);
    const assets = enabledModules.has(CompanyModuleCode.ASSETS);
    const delivery = enabledModules.has(CompanyModuleCode.DELIVERY);
    const fileStorage = enabledModules.has(CompanyModuleCode.FILE_STORAGE);
    const recruitment = enabledModules.has(CompanyModuleCode.RECRUITMENT);
    const recruitmentShortlist =
      recruitment &&
      enabledModules.has(CompanyModuleCode.RECRUITMENT_SHORTLIST);

    const permissions = user.authorization.permissions;
    const hasPlatformWideAccess =
      user.authorization.isGlobal ||
      user.authorization.roles.includes('SUPER_ADMINISTRATOR') ||
      permissions.includes('platform.admin');
    const payrollBlockedReasons = [
      ...(!payroll ? ['PAYROLL_MODULE_NOT_ENABLED'] : []),
      ...(!finance ? ['PAYROLL_FINANCE_MODULE_NOT_ENABLED'] : []),
      ...(!fileStorage ? ['PAYROLL_FILE_STORAGE_MODULE_NOT_ENABLED'] : []),
      ...(!this.configService.get('WORKFORCE_JOBS_ENABLED', { infer: true })
        ? ['PAYROLL_WORKFORCE_JOBS_NOT_ENABLED']
        : []),
    ];
    const deliveryOperationsPermission = this.hasAnyPermission(
      permissions,
      ['platform.delivery.read', 'hr.recruitment.delivery.read'],
      hasPlatformWideAccess,
    );
    // Company entitlement determines product availability; no retired delivery
    // config flag gates the operations navigation.
    const deliveryOperationsNav = delivery && deliveryOperationsPermission;

    return {
      projects,
      finance,
      payroll,
      payrollDependencyState: {
        ready: payrollBlockedReasons.length === 0,
        blockedReasons: payrollBlockedReasons,
      },
      projectsNav:
        projects &&
        this.hasAnyPermission(
          permissions,
          [
            'projects.projects.read',
            'projects.projects.manage',
            'projects.tasks.work',
            'projects.timesheets.submit',
            'projects.timesheets.approve',
          ],
          hasPlatformWideAccess,
        ),
      onboardingNav:
        onboarding &&
        this.hasAnyPermission(
          permissions,
          [
            ONBOARDING_PERMISSIONS.READ,
            ONBOARDING_PERMISSIONS.MANAGE,
            ONBOARDING_PERMISSIONS.DEPARTMENT_READ,
            ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN,
            ONBOARDING_PERMISSIONS.SELF_READ,
          ],
          hasPlatformWideAccess,
        ),
      assetsNav:
        assets &&
        this.hasAnyPermission(
          permissions,
          [
            ...ASSET_INVENTORY_READ_PERMISSIONS,
            ...ASSET_CUSTODY_READ_PERMISSIONS,
          ],
          hasPlatformWideAccess,
        ),
      assetSelfNav:
        assets &&
        this.hasPermission(permissions, 'hr.self.read', hasPlatformWideAccess),
      deliveryOperationsNav,
      fileOperationsNav:
        fileStorage &&
        this.hasPermission(
          permissions,
          'files.operations.read',
          hasPlatformWideAccess,
        ),
      recruitmentNav:
        recruitment &&
        this.hasPermission(
          permissions,
          'hr.recruitment.read',
          hasPlatformWideAccess,
        ),
      recruitmentShortlist:
        recruitmentShortlist &&
        this.hasPermission(
          permissions,
          'hr.recruitment.read',
          hasPlatformWideAccess,
        ),
      financeNav:
        finance &&
        (hasPlatformWideAccess ||
          permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_READ) ||
          permissions.includes(FINANCE_PERMISSIONS.REPORTS_READ) ||
          permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)),
      payrollNav:
        payroll &&
        (hasPlatformWideAccess ||
          permissions.includes(PAYROLL_PERMISSIONS.PAYROLL_READ) ||
          permissions.includes(PAYROLL_PERMISSIONS.SELF_READ)),
      financeActions: finance
        ? this.buildFinanceActions(permissions, hasPlatformWideAccess)
        : undefined,
      payrollActions: payroll
        ? this.buildPayrollActions(permissions, hasPlatformWideAccess)
        : undefined,
    };
  }

  private buildFinanceActions(
    permissions: string[],
    hasPlatformWideAccess: boolean,
  ): FinanceCollectionAction[] {
    const actions: FinanceCollectionAction[] = [];

    if (
      this.hasPermission(
        permissions,
        FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE,
        hasPlatformWideAccess,
      )
    ) {
      actions.push('CREATE_TRANSACTION');
    }
    if (
      this.hasPermission(
        permissions,
        FINANCE_PERMISSIONS.SETTINGS_MANAGE,
        hasPlatformWideAccess,
      )
    ) {
      actions.push('MANAGE_SETUP', 'CREATE_PERIOD');
    }
    if (
      this.hasPermission(
        permissions,
        FINANCE_PERMISSIONS.REPORTS_READ,
        hasPlatformWideAccess,
      )
    ) {
      actions.push('EXPORT_REPORT');
    }

    return actions;
  }

  private buildPayrollActions(
    permissions: string[],
    hasPlatformWideAccess: boolean,
  ): PayrollCollectionAction[] {
    const actions: PayrollCollectionAction[] = [];

    if (
      this.hasPermission(
        permissions,
        PAYROLL_PERMISSIONS.PAYROLL_MANAGE,
        hasPlatformWideAccess,
      )
    ) {
      actions.push('CREATE_RUN', 'MANAGE_COMPONENTS', 'MANAGE_EMPLOYEE_INPUTS');
    }
    if (
      this.hasPermission(
        permissions,
        PAYROLL_PERMISSIONS.PAYROLL_READ,
        hasPlatformWideAccess,
      )
    ) {
      actions.push('EXPORT_REGISTER');
    }

    return actions;
  }

  private hasAnyPermission(
    permissions: string[],
    required: readonly string[],
    hasPlatformWideAccess: boolean,
  ): boolean {
    return (
      hasPlatformWideAccess ||
      required.some((permission) => permissions.includes(permission))
    );
  }

  private hasPermission(
    permissions: string[],
    required: string,
    hasPlatformWideAccess: boolean,
  ): boolean {
    return hasPlatformWideAccess || permissions.includes(required);
  }
}
