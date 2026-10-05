import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyModuleCode } from '@prisma/client';

import type { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { FileStorageFeatureService } from '../../file-storage/services/file-storage-feature.service';
import { CompanyModuleEntitlementService } from '../../module-capabilities';
import { OfficeFinanceFeatureService } from '../../office-finance/services/office-finance-feature.service';

@Injectable()
export class PayrollFeatureService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
    private readonly entitlements: CompanyModuleEntitlementService,
    private readonly financeFeature: OfficeFinanceFeatureService,
    private readonly fileStorageFeature: FileStorageFeatureService,
  ) {}

  isEnabledForCompany(companyId: string | null | undefined): Promise<boolean> {
    return this.entitlements.isEnabled(companyId, CompanyModuleCode.PAYROLL);
  }

  async getReadiness(companyId: string): Promise<{
    ready: boolean;
    blockedReasons: string[];
  }> {
    const blockedReasons: string[] = [];
    const [payrollEnabled, financeEnabled] = await Promise.all([
      this.isEnabledForCompany(companyId),
      this.financeFeature.isEnabledForCompany(companyId),
    ]);
    if (!payrollEnabled) {
      blockedReasons.push('PAYROLL_MODULE_NOT_ENABLED');
    }
    if (!financeEnabled) {
      blockedReasons.push('PAYROLL_FINANCE_MODULE_NOT_ENABLED');
    }
    if (!this.configService.get('WORKFORCE_JOBS_ENABLED', { infer: true })) {
      blockedReasons.push('PAYROLL_WORKFORCE_JOBS_NOT_ENABLED');
    }

    const [branches, profile, openPeriod] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, isActive: true },
        select: { branchId: true },
        distinct: ['branchId'],
      }),
      this.prisma.companyFinancialProfile.findUnique({
        where: { companyId },
        select: {
          baseCurrencyCode: true,
          payrollExpenseCategoryId: true,
          payrollExpenseCategory: {
            select: {
              categoryType: true,
              isActive: true,
              archivedAt: true,
            },
          },
        },
      }),
      this.prisma.financePeriod.findFirst({
        where: { companyId, status: 'OPEN' },
        select: { id: true },
      }),
    ]);

    const activePaymentAccount = profile?.baseCurrencyCode
      ? await this.prisma.financePaymentAccount.findFirst({
          where: {
            companyId,
            isActive: true,
            archivedAt: null,
            currencyCode: profile.baseCurrencyCode,
          },
          select: { id: true },
        })
      : null;

    const branchCoverage = await Promise.all(
      branches.map(async ({ branchId }) => ({
        branchId,
        enabled: await this.fileStorageFeature.isScopeAllowed(
          companyId,
          branchId,
        ),
      })),
    );
    const uncoveredBranches = branchCoverage.filter(({ enabled }) => !enabled);
    if (uncoveredBranches.length > 0) {
      blockedReasons.push('PAYROLL_FILE_STORAGE_SCOPE_NOT_ENABLED');
    }
    if (
      !profile?.baseCurrencyCode ||
      !profile.payrollExpenseCategoryId ||
      profile.payrollExpenseCategory?.categoryType !== 'EXPENSE' ||
      !profile.payrollExpenseCategory.isActive ||
      profile.payrollExpenseCategory.archivedAt
    ) {
      blockedReasons.push('PAYROLL_FINANCE_SETUP_REQUIRED');
    }
    if (!activePaymentAccount) {
      blockedReasons.push('PAYROLL_PAYMENT_ACCOUNT_REQUIRED');
    }
    if (!openPeriod) {
      blockedReasons.push('PAYROLL_OPEN_FINANCE_PERIOD_REQUIRED');
    }
    return { ready: blockedReasons.length === 0, blockedReasons };
  }
}
