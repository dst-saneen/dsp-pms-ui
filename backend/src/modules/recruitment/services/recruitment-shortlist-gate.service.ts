import { Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { CompanyModuleEntitlementService } from '../../module-capabilities';

@Injectable()
export class RecruitmentShortlistGateService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  /**
   * Shortlisting is a separately provisioned recruitment capability. It never
   * enables the domain on its own: the Company must also retain Recruitment.
   */
  isEnabledForCompany(companyId: string | null | undefined): Promise<boolean> {
    return this.entitlements.areEnabled(companyId, [
      CompanyModuleCode.RECRUITMENT,
      CompanyModuleCode.RECRUITMENT_SHORTLIST,
    ]);
  }
}
