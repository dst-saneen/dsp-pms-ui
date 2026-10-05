import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyModuleCode } from '@prisma/client';

import { Environment } from '../../../config';
import { CompanyModuleEntitlementService } from '../../module-capabilities';

@Injectable()
export class FileStorageFeatureService {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly entitlements: CompanyModuleEntitlementService,
  ) {}

  /**
   * Resolves File Storage availability from the live Company entitlement.
   * CompanyModuleEntitlementService also requires Company.isActive, so this
   * deliberately invalidates stale upload sessions after a Company is
   * deactivated.
   */
  async assertStorageAvailable(
    companyId: string,
    branchId: string | null,
  ): Promise<void> {
    void branchId;
    if (await this.isScopeAllowed(companyId, branchId)) {
      return;
    }

    throw new ForbiddenException({ code: 'FILE_STORAGE_MODULE_NOT_ENABLED' });
  }

  /**
   * Kept as the write-oriented public API for callers which create or mutate
   * storage records. Reads and existing-session operations use
   * assertStorageAvailable so they fail closed too.
   */
  async assertStorageWritesAllowed(
    companyId: string,
    branchId: string | null,
  ): Promise<void> {
    await this.assertStorageAvailable(companyId, branchId);
  }

  /**
   * A signed offer is a Recruitment workflow backed by File Storage. Do not
   * let a valid public token keep either workflow usable after an entitlement
   * is withdrawn.
   */
  async assertSignedOfferWorkflowAllowed(
    companyId: string,
    branchId: string | null,
  ): Promise<void> {
    if (
      !(await this.entitlements.isEnabled(
        companyId,
        CompanyModuleCode.RECRUITMENT,
      ))
    ) {
      throw new ForbiddenException({
        code: 'RECRUITMENT_MODULE_NOT_ENABLED',
      });
    }

    await this.assertStorageAvailable(companyId, branchId);
  }

  isScopeAllowed(companyId: string, branchId: string | null): Promise<boolean> {
    void branchId;
    return this.entitlements.isEnabled(
      companyId,
      CompanyModuleCode.FILE_STORAGE,
    );
  }

  signedOfferEnabled(): boolean {
    if (this.config.get('SIGNED_OFFER_VERIFICATION_ENABLED', { infer: true })) {
      return true;
    }

    return this.config.get('NODE_ENV', { infer: true }) !== 'production';
  }

  scanWorkerEnabled(): boolean {
    return this.config.get('FILE_SCAN_WORKER_ENABLED', { infer: true });
  }

  retentionPurgeEnabled(): boolean {
    return this.config.get('FILE_RETENTION_PURGE_ENABLED', { infer: true });
  }
}
