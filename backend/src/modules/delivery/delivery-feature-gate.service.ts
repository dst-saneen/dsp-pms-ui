import { Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { DomainConflictException } from '../../common';
import { CompanyModuleEntitlementService } from '../module-capabilities/company-module-entitlement.service';

/** Company-owned Delivery availability; Branches inherit their Company's state. */
@Injectable()
export class DeliveryFeatureGateService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  async isEnabledForCompany(
    companyId: string | null | undefined,
  ): Promise<boolean> {
    return this.entitlements.isEnabled(companyId, CompanyModuleCode.DELIVERY);
  }

  async hasAnyEnabledCompany(): Promise<boolean> {
    return this.entitlements.hasAnyEnabled(CompanyModuleCode.DELIVERY);
  }

  async assertEnabledForCompany(
    companyId: string | null | undefined,
  ): Promise<void> {
    if (await this.isEnabledForCompany(companyId)) {
      return;
    }

    throw new DomainConflictException(
      'DELIVERY_MODULE_NOT_ENABLED',
      'Delivery is not enabled for this Company.',
    );
  }
}
