import { ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { CompanyModuleEntitlementService } from '../../module-capabilities';

import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';

/**
 * Company-owned availability for the recruitment domain. Product availability
 * is intentionally resolved from the entitlement table, not deployment
 * configuration, so a disabled Company fails closed everywhere it is used.
 */
@Injectable()
export class RecruitmentFeatureGateService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  isEnabledForCompany(companyId: string | null | undefined): Promise<boolean> {
    return this.entitlements.isEnabled(
      companyId,
      CompanyModuleCode.RECRUITMENT,
    );
  }

  async assertEnabledForCompany(
    companyId: string | null | undefined,
  ): Promise<void> {
    if (await this.isEnabledForCompany(companyId)) {
      return;
    }

    throw new ForbiddenException({
      code: RECRUITMENT_ERROR_CODES.RECRUITMENT_MODULE_NOT_ENABLED,
      message: 'Recruitment is not enabled for this Company.',
    });
  }
}
