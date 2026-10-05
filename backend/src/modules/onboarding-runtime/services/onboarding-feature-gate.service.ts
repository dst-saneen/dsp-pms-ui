import { ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { getOrganizationScope } from '../../../common';
import { CompanyModuleEntitlementService } from '../../module-capabilities';

import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';

@Injectable()
export class OnboardingFeatureGateService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  hasAnyEnabledCompany(): Promise<boolean> {
    return this.entitlements.hasAnyEnabled(CompanyModuleCode.ONBOARDING);
  }

  async isEnabledForContext(
    companyId?: string,
    branchId?: string,
  ): Promise<boolean> {
    void branchId;
    const scope = getOrganizationScope();
    const resolvedCompanyId = companyId ?? scope.activeCompanyId;
    return this.entitlements.isEnabled(
      resolvedCompanyId,
      CompanyModuleCode.ONBOARDING,
    );
  }

  async assertEnabledForContext(
    companyId?: string,
    branchId?: string,
  ): Promise<void> {
    if (!(await this.isEnabledForContext(companyId, branchId))) {
      throw new ForbiddenException({
        code: ONBOARDING_ERROR_CODES.ONBOARDING_MODULE_NOT_ENABLED,
        message: 'Onboarding is not enabled for this Company.',
      });
    }
  }
}
