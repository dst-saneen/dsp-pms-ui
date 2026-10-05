import { Injectable } from '@nestjs/common';
import {
  BusinessParty,
  CompanyFinancialProfile,
  FinanceCategory,
  FinancePaymentAccount,
  FinancePeriod,
  FinanceTransaction,
} from '@prisma/client';

import type {
  FinanceTransactionAction,
  PaginatedResponse,
} from '../dto/finance-api.types';
import type { TaxonomyAllowedAction } from './finance-capability.service';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

@Injectable()
export class FinanceResponseMapper {
  constructor(private readonly scope: OfficeFinanceScopeService) {}

  toFinancialProfile(
    profile: CompanyFinancialProfile,
    allowedActions: TaxonomyAllowedAction[] = ['EDIT'],
  ) {
    return {
      id: profile.id,
      companyId: profile.companyId,
      baseCurrencyCode: profile.baseCurrencyCode,
      reportingStartDate: this.scope.formatDate(profile.reportingStartDate),
      payrollExpenseCategoryId: profile.payrollExpenseCategoryId,
      version: profile.version,
      allowedActions,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  toBusinessParty(
    party: BusinessParty,
    allowedActions: TaxonomyAllowedAction[],
  ) {
    return {
      id: party.id,
      companyId: party.companyId,
      partyCode: party.partyCode,
      displayName: party.displayName,
      normalizedName: party.normalizedName,
      partyType: party.partyType,
      contactPerson: party.contactPerson,
      email: party.email,
      phone: party.phone,
      taxRegistrationRef: party.taxRegistrationRef,
      version: party.version,
      isActive: party.isActive,
      archivedAt: party.archivedAt?.toISOString() ?? null,
      allowedActions,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    };
  }

  toCategory(
    category: FinanceCategory,
    allowedActions: TaxonomyAllowedAction[],
  ) {
    return {
      id: category.id,
      companyId: category.companyId,
      categoryCode: category.categoryCode,
      categoryName: category.categoryName,
      categoryType: category.categoryType,
      description: category.description,
      version: category.version,
      isActive: category.isActive,
      archivedAt: category.archivedAt?.toISOString() ?? null,
      allowedActions,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  toPaymentAccount(
    account: FinancePaymentAccount,
    allowedActions: TaxonomyAllowedAction[],
    projectedBalance?: string,
  ) {
    return {
      id: account.id,
      companyId: account.companyId,
      branchId: account.branchId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      currencyCode: account.currencyCode,
      openingBalance: this.scope.decimalToString(account.openingBalance),
      openingDate: this.scope.formatDate(account.openingDate),
      bankName: account.bankName,
      bankLastFour: account.bankLastFour,
      version: account.version,
      isActive: account.isActive,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      projectedBalance,
      allowedActions,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  toPeriod(period: FinancePeriod, allowedActions: string[]) {
    return {
      id: period.id,
      companyId: period.companyId,
      periodYear: period.periodYear,
      periodMonth: period.periodMonth,
      periodStart: this.scope.formatDate(period.periodStart),
      periodEnd: this.scope.formatDate(period.periodEnd),
      status: period.status,
      version: period.version,
      lockedAt: period.lockedAt?.toISOString() ?? null,
      reopenedAt: period.reopenedAt?.toISOString() ?? null,
      allowedActions,
      createdAt: period.createdAt.toISOString(),
      updatedAt: period.updatedAt.toISOString(),
    };
  }

  toTransaction(
    transaction: FinanceTransaction,
    allowedActions: FinanceTransactionAction[],
  ) {
    return {
      id: transaction.id,
      companyId: transaction.companyId,
      branchId: transaction.branchId,
      transactionNumber: transaction.transactionNumber,
      version: transaction.version,
      transactionDate: this.scope.formatDate(transaction.transactionDate),
      transactionType: transaction.transactionType,
      status: transaction.status,
      amount: this.scope.decimalToString(transaction.amount),
      taxAmount: this.scope.decimalToString(transaction.taxAmount),
      currencyCode: transaction.currencyCode,
      categoryId: transaction.categoryId,
      departmentId: transaction.departmentId,
      projectId: transaction.projectId,
      businessPartyId: transaction.businessPartyId,
      employeeId: transaction.employeeId,
      description: transaction.description,
      sourceType: transaction.sourceType,
      sourceId: transaction.sourceId,
      movement: {
        sourceAccountId: transaction.sourceAccountId,
        destinationAccountId: transaction.destinationAccountId,
      },
      reversalOfTransactionId: transaction.reversalOfTransactionId,
      reversedByTransactionId: transaction.reversedByTransactionId,
      warnings: this.scope.buildTransactionWarnings(transaction),
      allowedActions,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }

  toPaginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return this.scope.toPaginated(items, total, page, limit);
  }
}
