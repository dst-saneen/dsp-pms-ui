import { Injectable } from '@nestjs/common';
import {
  FinanceActionEntityType,
  FinanceSourceType,
  FinanceTransactionStatus,
  FinanceTransactionType,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NumberSeriesService } from '../../number-series';

import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FinanceTransactionValidatorService } from './finance-transaction-validator.service';
import { OfficeFinanceFeatureService } from './office-finance-feature.service';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

type DbClient = Prisma.TransactionClient;

export interface CreatePayrollExpenseInput {
  companyId: string;
  payrollRunId: string;
  payrollRunNumber: string;
  payrollPeriodStart: string;
  paidDate: string;
  aggregateNetAmount: string;
  paymentAccountId: string;
  payrollCreatorUserId: string;
  payrollApproverUserId: string;
  recordedByUserId: string;
  operationContext: {
    operationId: string;
  };
}

@Injectable()
export class PayrollExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly featureService: OfficeFinanceFeatureService,
    private readonly numberSeries: NumberSeriesService,
    private readonly validator: FinanceTransactionValidatorService,
  ) {}

  async createPayrollExpenseWithinTransaction(
    tx: DbClient,
    input: CreatePayrollExpenseInput,
  ) {
    if (!(await this.featureService.isEnabledForCompany(input.companyId))) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.OFFICE_FINANCE_SCOPE_NOT_ENABLED,
        'Finance is not enabled for this Company.',
      );
    }

    const existing = await tx.financeTransaction.findFirst({
      where: {
        companyId: input.companyId,
        sourceType: FinanceSourceType.PAYROLL_RUN,
        sourceId: input.payrollRunId,
      },
    });

    if (existing) {
      return existing;
    }

    const profile = await tx.companyFinancialProfile.findUnique({
      where: { companyId: input.companyId },
    });

    if (!profile?.payrollExpenseCategoryId) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCIAL_PROFILE_NOT_CONFIGURED,
        'Payroll expense category is not configured.',
      );
    }

    await this.scope.lockPaymentAccountsForUpdate(tx, [input.paymentAccountId]);

    const account = await tx.financePaymentAccount.findFirst({
      where: {
        id: input.paymentAccountId,
        companyId: input.companyId,
        isActive: true,
        archivedAt: null,
      },
    });

    if (!account) {
      this.scope.notFound('Payment account');
    }

    const paidDate = this.scope.parseDate(input.paidDate, 'paidDate');
    const amount = this.scope.parseMoney(
      input.aggregateNetAmount,
      'aggregateNetAmount',
    );

    if (input.payrollCreatorUserId === input.payrollApproverUserId) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_SELF_APPROVAL_FORBIDDEN,
        'Payroll creator and approver must differ.',
      );
    }

    const branchId = await this.validator.validateMerged(
      tx,
      input.companyId,
      {
        transactionType: FinanceTransactionType.EXPENSE,
        transactionDate: paidDate,
        amount,
        taxAmount: new Prisma.Decimal(0),
        currencyCode: profile.baseCurrencyCode,
        categoryId: profile.payrollExpenseCategoryId,
        sourceAccountId: account.id,
        destinationAccountId: null,
        sourceType: FinanceSourceType.PAYROLL_RUN,
        description: `Payroll ${input.payrollRunNumber}`,
      },
      {
        allowPayrollSource: true,
        expectedPayrollCategoryId: profile.payrollExpenseCategoryId,
      },
    );

    const transactionNumber = await this.numberSeries.next(
      'FINANCE_TRANSACTION',
      input.companyId,
      'FT',
      6,
      tx,
    );

    const created = await tx.financeTransaction.create({
      data: {
        companyId: input.companyId,
        branchId,
        transactionNumber,
        transactionDate: paidDate,
        transactionType: FinanceTransactionType.EXPENSE,
        status: FinanceTransactionStatus.APPROVED,
        amount,
        taxAmount: new Prisma.Decimal(0),
        currencyCode: profile.baseCurrencyCode,
        categoryId: profile.payrollExpenseCategoryId,
        sourceAccountId: account.id,
        description: `Payroll ${input.payrollRunNumber}`,
        reference: input.payrollRunNumber,
        sourceType: FinanceSourceType.PAYROLL_RUN,
        sourceId: input.payrollRunId,
        createdByUserId: input.payrollCreatorUserId,
        submittedByUserId: input.payrollCreatorUserId,
        submittedAt: new Date(),
        approvedByUserId: input.payrollApproverUserId,
        approvedAt: new Date(),
      },
    });

    await this.scope.recordActionEvent(tx, {
      companyId: input.companyId,
      entityType: FinanceActionEntityType.TRANSACTION,
      entityId: created.id,
      action: 'PAYROLL_EXPENSE_RECORDED',
      fromStatus: null,
      toStatus: created.status,
      actorUserId: input.recordedByUserId,
      operationId: input.operationContext.operationId,
      versionBefore: 0,
      versionAfter: created.version,
    });

    return created;
  }
}
