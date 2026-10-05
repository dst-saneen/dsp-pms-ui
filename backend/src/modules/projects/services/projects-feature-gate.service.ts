import { ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { DomainConflictException, getOrganizationScope } from '../../../common';
import { CompanyModuleEntitlementService } from '../../module-capabilities';

import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';

@Injectable()
export class ProjectsFeatureGateService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  hasAnyEnabledCompany(): Promise<boolean> {
    return this.entitlements.hasAnyEnabled(CompanyModuleCode.PROJECTS);
  }

  /**
   * Resolves exactly one Company for Projects. Global / Company Group
   * actors must select an active Company — never an unrestricted filter.
   */
  requireActiveCompanyId(explicitCompanyId?: string): string {
    const scope = getOrganizationScope();
    const companyId = explicitCompanyId ?? scope.activeCompanyId;
    if (!companyId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECTS_COMPANY_CONTEXT_REQUIRED,
        'Select a Company before using Projects.',
      );
    }
    return companyId;
  }

  async isEnabledForContext(companyId?: string): Promise<boolean> {
    let resolvedCompanyId: string;
    try {
      resolvedCompanyId = this.requireActiveCompanyId(companyId);
    } catch {
      return false;
    }

    return this.entitlements.isEnabled(
      resolvedCompanyId,
      CompanyModuleCode.PROJECTS,
    );
  }

  async assertEnabledForContext(companyId?: string): Promise<void> {
    const resolvedCompanyId = this.requireActiveCompanyId(companyId);
    if (
      !(await this.entitlements.isEnabled(
        resolvedCompanyId,
        CompanyModuleCode.PROJECTS,
      ))
    ) {
      throw new ForbiddenException({
        code: PROJECTS_ERROR_CODES.PROJECTS_MODULE_NOT_ENABLED,
        message: 'Projects is not enabled for this scope.',
      });
    }
  }
}
