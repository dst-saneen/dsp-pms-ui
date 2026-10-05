import { Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { DomainConflictException } from '../../common';
import { CompanyModuleEntitlementService } from '../module-capabilities/company-module-entitlement.service';

import type { AssetAccessContext } from './asset-access.types';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

/**
 * Company-owned Assets availability. A Company entitlement applies to every
 * Branch in that Company; request headers and client-provided rollout flags
 * never participate in the decision.
 */
@Injectable()
export class AssetFeatureGateService {
  constructor(private readonly entitlements: CompanyModuleEntitlementService) {}

  async isEnabledForCompany(companyId?: string): Promise<boolean> {
    return this.entitlements.isEnabled(companyId, CompanyModuleCode.ASSETS);
  }

  async assertEnabled(context: AssetAccessContext): Promise<void> {
    await this.assertEnabledForCompany(context.activeCompanyId);
  }

  async assertEnabledForCompany(companyId?: string): Promise<void> {
    if (await this.isEnabledForCompany(companyId)) {
      return;
    }

    throw new DomainConflictException(
      ASSET_ERROR_CODES.ASSET_MODULE_NOT_ENABLED,
      'Assets is not enabled for this Company.',
    );
  }

  async assertTransferPair(input: {
    companyId: string;
    fromBranchId: string | null | undefined;
    toBranchId: string | null | undefined;
  }): Promise<void> {
    if (!input.fromBranchId || !input.toBranchId) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_TRANSFER_INVALID_DESTINATION,
        'Transfer source and destination Branches are required',
      );
    }

    await this.assertEnabledForCompany(input.companyId);
  }
}
