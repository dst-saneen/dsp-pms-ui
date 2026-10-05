import { Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Product modules provisioned for every active Company. Keep this list aligned
 * with the migration's database trigger; it is exported for tests and future
 * administrative entitlement tooling.
 */
export const DEFAULT_COMPANY_MODULE_CODES = [
  CompanyModuleCode.ASSETS,
  CompanyModuleCode.DELIVERY,
  CompanyModuleCode.FILE_STORAGE,
  CompanyModuleCode.FINANCE,
  CompanyModuleCode.ONBOARDING,
  CompanyModuleCode.PAYROLL,
  CompanyModuleCode.PROJECTS,
  CompanyModuleCode.RECRUITMENT,
  CompanyModuleCode.RECRUITMENT_SHORTLIST,
] as const;

@Injectable()
export class CompanyModuleEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A missing entitlement deliberately fails closed. The active Company check
   * prevents a stale session from exposing modules after deactivation.
   */
  async getEnabledModules(
    companyId: string | null | undefined,
  ): Promise<Set<CompanyModuleCode>> {
    if (!companyId) {
      return new Set();
    }

    const rows = await this.prisma.companyModuleEntitlement.findMany({
      where: {
        companyId,
        isEnabled: true,
        company: { isActive: true },
      },
      select: { module: true },
    });

    return new Set(rows.map((row) => row.module));
  }

  async isEnabled(
    companyId: string | null | undefined,
    module: CompanyModuleCode,
  ): Promise<boolean> {
    if (!companyId) {
      return false;
    }

    const entitlement = await this.prisma.companyModuleEntitlement.findFirst({
      where: {
        companyId,
        module,
        isEnabled: true,
        company: { isActive: true },
      },
      select: { id: true },
    });

    return Boolean(entitlement);
  }

  async hasAnyEnabled(module: CompanyModuleCode): Promise<boolean> {
    const entitlement = await this.prisma.companyModuleEntitlement.findFirst({
      where: {
        module,
        isEnabled: true,
        company: { isActive: true },
      },
      select: { id: true },
    });

    return Boolean(entitlement);
  }

  async getEnabledCompanyIds(module: CompanyModuleCode): Promise<string[]> {
    const rows = await this.prisma.companyModuleEntitlement.findMany({
      where: {
        module,
        isEnabled: true,
        company: { isActive: true },
      },
      select: { companyId: true },
    });

    return rows.map((row) => row.companyId);
  }

  async areEnabled(
    companyId: string | null | undefined,
    modules: readonly CompanyModuleCode[],
  ): Promise<boolean> {
    if (!companyId || modules.length === 0) {
      return false;
    }

    const enabled = await this.getEnabledModules(companyId);
    return modules.every((module) => enabled.has(module));
  }
}
