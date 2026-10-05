import { Injectable } from '@nestjs/common';
import {
  FinanceCategoryType,
  FinanceSourceType,
  FinanceTransactionType,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';

import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { OfficeFinancePeriodsService } from './office-finance-periods.service';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

type DbClient = Prisma.TransactionClient;

export interface FinanceTransactionShape {
  transactionType: FinanceTransactionType;
  transactionDate: Date;
  amount: Prisma.Decimal | string;
  taxAmount: Prisma.Decimal | string;
  currencyCode: string;
  categoryId?: string | null;
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
  businessPartyId?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  sourceType?: FinanceSourceType | null;
  description?: string | null;
}

@Injectable()
export class FinanceTransactionValidatorService {
  constructor(
    private readonly scope: OfficeFinanceScopeService,
    private readonly periods: OfficeFinancePeriodsService,
  ) {}

  async validateMerged(
    tx: DbClient,
    companyId: string,
    shape: FinanceTransactionShape,
    options?: {
      allowPayrollSource?: boolean;
      expectedPayrollCategoryId?: string | null;
    },
  ): Promise<string | null> {
    const sourceType = shape.sourceType ?? FinanceSourceType.MANUAL;

    if (
      sourceType === FinanceSourceType.PAYROLL_RUN &&
      !options?.allowPayrollSource
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Payroll-sourced expenses cannot be created through manual endpoints.',
      );
    }

    const profile = await tx.companyFinancialProfile.findUnique({
      where: { companyId },
    });

    if (!profile?.baseCurrencyCode) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCIAL_PROFILE_NOT_CONFIGURED,
        'Financial profile is not configured for this Company.',
      );
    }

    if (shape.currencyCode !== profile.baseCurrencyCode) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Transaction currency must match the Company base currency.',
      );
    }

    await this.periods.assertOpenPeriodForDate(
      tx,
      companyId,
      shape.transactionDate,
    );

    const amount =
      shape.amount instanceof Prisma.Decimal
        ? shape.amount
        : this.scope.parseMoney(String(shape.amount), 'amount');
    const taxAmount =
      shape.taxAmount instanceof Prisma.Decimal
        ? shape.taxAmount
        : this.scope.parseMoney(String(shape.taxAmount ?? '0'), 'taxAmount');

    if (amount.lessThanOrEqualTo(0)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Amount must be positive.',
      );
    }

    if (taxAmount.lessThan(0) || taxAmount.greaterThan(amount)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Tax amount must be between 0 and amount inclusive.',
      );
    }

    if (shape.businessPartyId && shape.employeeId) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Business party and employee are mutually exclusive.',
      );
    }

    this.assertTypeShape(shape);

    if (shape.categoryId) {
      const category = await tx.financeCategory.findFirst({
        where: {
          id: shape.categoryId,
          companyId,
          isActive: true,
          archivedAt: null,
        },
      });

      if (!category) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Category is missing, inactive, or outside Company scope.',
        );
      }

      if (
        shape.transactionType === FinanceTransactionType.INCOME &&
        category.categoryType !== FinanceCategoryType.INCOME
      ) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Income transactions require an income category.',
        );
      }

      if (
        shape.transactionType === FinanceTransactionType.EXPENSE &&
        category.categoryType !== FinanceCategoryType.EXPENSE
      ) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Expense transactions require an expense category.',
        );
      }

      if (
        sourceType === FinanceSourceType.PAYROLL_RUN &&
        options?.expectedPayrollCategoryId &&
        category.id !== options.expectedPayrollCategoryId
      ) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Payroll expense must use the configured payroll category.',
        );
      }
    }

    const sourceAccount = await this.assertAccount(
      tx,
      companyId,
      shape.sourceAccountId,
      profile.baseCurrencyCode,
      'source',
      shape.transactionDate,
    );
    const destinationAccount = await this.assertAccount(
      tx,
      companyId,
      shape.destinationAccountId,
      profile.baseCurrencyCode,
      'destination',
      shape.transactionDate,
    );
    const branchIds = [
      sourceAccount?.branchId,
      destinationAccount?.branchId,
    ].filter((value): value is string => Boolean(value));

    if (shape.businessPartyId) {
      const party = await tx.businessParty.findFirst({
        where: {
          id: shape.businessPartyId,
          companyId,
          isActive: true,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!party) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Business party is missing, inactive, or outside Company scope.',
        );
      }
    }

    if (shape.employeeId) {
      const employee = await tx.employee.findFirst({
        where: {
          id: shape.employeeId,
          companyId,
          isActive: true,
        },
        select: { id: true, branchId: true },
      });
      if (!employee) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Employee is missing, inactive, or outside Company scope.',
        );
      }
      if (employee.branchId) branchIds.push(employee.branchId);
    }

    if (shape.departmentId) {
      const department = await tx.department.findFirst({
        where: {
          id: shape.departmentId,
          companyId,
          isActive: true,
        },
        select: { id: true, branchId: true },
      });
      if (!department) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Department is missing, inactive, or outside Company scope.',
        );
      }
      branchIds.push(department.branchId);
    }

    if (shape.projectId) {
      const project = await tx.project.findFirst({
        where: {
          id: shape.projectId,
          companyId,
          statusV2: { not: 'CANCELLED' },
        },
        select: { id: true, branchId: true },
      });
      if (!project) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Project is missing, cancelled, or outside Company scope.',
        );
      }
      if (project.branchId) branchIds.push(project.branchId);
    }

    if (
      sourceType === FinanceSourceType.PAYROLL_RUN &&
      shape.transactionType !== FinanceTransactionType.EXPENSE
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Payroll source must be an expense transaction.',
      );
    }

    if (
      shape.transactionType === FinanceTransactionType.TRANSFER &&
      sourceAccount?.branchId &&
      destinationAccount?.branchId &&
      sourceAccount.branchId !== destinationAccount.branchId
    ) {
      return null;
    }

    const uniqueBranches = [...new Set(branchIds)];
    if (uniqueBranches.length > 1) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        'Selected accounts and classification records must belong to a compatible Branch.',
      );
    }
    return uniqueBranches[0] ?? null;
  }

  private assertTypeShape(shape: FinanceTransactionShape) {
    switch (shape.transactionType) {
      case FinanceTransactionType.INCOME:
        if (
          !shape.categoryId ||
          !shape.destinationAccountId ||
          shape.sourceAccountId
        ) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
            'Income requires category and destination account only.',
          );
        }
        break;
      case FinanceTransactionType.EXPENSE:
        if (
          !shape.categoryId ||
          !shape.sourceAccountId ||
          shape.destinationAccountId
        ) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
            'Expense requires category and source account only.',
          );
        }
        break;
      case FinanceTransactionType.TRANSFER:
        if (
          !shape.sourceAccountId ||
          !shape.destinationAccountId ||
          shape.categoryId ||
          shape.businessPartyId ||
          shape.employeeId ||
          shape.departmentId ||
          shape.projectId
        ) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
            'Transfer requires distinct source and destination accounts only.',
          );
        }
        if (shape.sourceAccountId === shape.destinationAccountId) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
            'Transfer accounts must differ.',
          );
        }
        break;
      default:
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
          'Unsupported transaction type.',
        );
    }
  }

  private async assertAccount(
    tx: DbClient,
    companyId: string,
    accountId: string | null | undefined,
    baseCurrencyCode: string,
    label: string,
    transactionDate: Date,
  ) {
    if (!accountId) {
      return null;
    }

    const account = await tx.financePaymentAccount.findFirst({
      where: {
        id: accountId,
        companyId,
        isActive: true,
        archivedAt: null,
      },
    });

    if (!account) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        `${label} payment account is missing, inactive, or outside Company scope.`,
      );
    }

    if (account.currencyCode !== baseCurrencyCode) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        `${label} payment account currency must match the Company base currency.`,
      );
    }
    if (transactionDate < account.openingDate) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
        `Transaction date cannot be before the ${label} payment account opening date.`,
      );
    }
    return account;
  }
}
