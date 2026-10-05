import { Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { CompanyModuleEntitlementService } from '../../module-capabilities';

@Injectable()
export class OfficeFinanceFeatureService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  isEnabledForCompany(companyId: string | null | undefined): Promise<boolean> {
    return this.entitlements.isEnabled(companyId, CompanyModuleCode.FINANCE);
  }
}
