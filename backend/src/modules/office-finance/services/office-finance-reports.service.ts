import { Injectable } from '@nestjs/common';
import {
  FinanceTransactionStatus,
  FinanceTransactionType,
  Prisma,
} from '@prisma/client';

import { csvEscapeCell } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import { FinanceReportQueryDto } from '../dto/finance-transaction.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { OfficeFinanceScopeService } from './office-finance-scope.service';
import { OfficeFinancePaymentAccountsService } from './office-finance-payment-accounts.service';

@Injectable()
export class OfficeFinanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly paymentAccounts: OfficeFinancePaymentAccountsService,
  ) {}

  async getDashboard(context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    );

    const summary = await this.aggregateIncomeExpense(
      companyId,
      {
        fromDate: this.scope.formatDate(monthStart),
        toDate: this.scope.formatDate(monthEnd),
      },
      context,
    );

    const pendingApproval = await this.prisma.financeTransaction.count({
      where: {
        ...this.scope.financeTransactionWhere(companyId, context),
        status: FinanceTransactionStatus.SUBMITTED,
      },
    });

    return {
      asOf: now.toISOString(),
      monthStart: this.scope.formatDate(monthStart),
      monthEnd: this.scope.formatDate(monthEnd),
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      net: summary.net,
      pendingApproval,
    };
  }

  incomeExpense(
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    return this.aggregateIncomeExpense(companyId, query, context);
  }

  byCategory(
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    return this.groupByField('categoryId', query, context);
  }

  byDepartment(
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    return this.groupByField('departmentId', query, context);
  }

  byProject(query: FinanceReportQueryDto, context: OfficeFinanceAccessContext) {
    return this.groupByField('projectId', query, context);
  }

  async accountMovements(
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where = this.reportWhere(companyId, query, true, context);
    const rows = await this.prisma.financeTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'asc' }, { transactionNumber: 'asc' }],
    });

    return {
      asOf: new Date().toISOString(),
      items: rows.map((row) => ({
        id: row.id,
        transactionNumber: row.transactionNumber,
        transactionDate: this.scope.formatDate(row.transactionDate),
        transactionType: row.transactionType,
        status: row.status,
        amount: this.scope.decimalToString(row.amount),
        sourceAccountId: row.sourceAccountId,
        destinationAccountId: row.destinationAccountId,
      })),
      includedStatuses: this.resolveStatuses(query),
      filters: query,
    };
  }

  async exportCsv(
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where = this.reportWhere(companyId, query, true, context);
    const rows = await this.prisma.financeTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'asc' }, { transactionNumber: 'asc' }],
    });

    const header = [
      'transactionNumber',
      'transactionDate',
      'transactionType',
      'status',
      'amount',
      'taxAmount',
      'currencyCode',
      'sourceAccountId',
      'destinationAccountId',
      'categoryId',
      'departmentId',
      'projectId',
      'businessPartyId',
      'description',
    ];

    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [
          csvEscapeCell(row.transactionNumber),
          csvEscapeCell(this.scope.formatDate(row.transactionDate)),
          csvEscapeCell(row.transactionType),
          csvEscapeCell(row.status),
          this.scope.decimalToString(row.amount),
          this.scope.decimalToString(row.taxAmount),
          csvEscapeCell(row.currencyCode),
          csvEscapeCell(row.sourceAccountId ?? ''),
          csvEscapeCell(row.destinationAccountId ?? ''),
          csvEscapeCell(row.categoryId ?? ''),
          csvEscapeCell(row.departmentId ?? ''),
          csvEscapeCell(row.projectId ?? ''),
          csvEscapeCell(row.businessPartyId ?? ''),
          csvEscapeCell(row.description),
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  async projectFinanceSummary(
    projectId: string,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.scope.financeProjectWhere(companyId, context),
      },
      select: { id: true, projectName: true },
    });

    if (!project) {
      this.scope.notFound('Project');
    }

    const rows = await this.prisma.financeTransaction.findMany({
      where: {
        ...this.scope.financeTransactionWhere(companyId, context),
        projectId,
        status: {
          in: [
            FinanceTransactionStatus.APPROVED,
            FinanceTransactionStatus.REVERSED,
          ],
        },
        transactionType: {
          in: [FinanceTransactionType.INCOME, FinanceTransactionType.EXPENSE],
        },
      },
      select: {
        transactionType: true,
        amount: true,
        sourceType: true,
      },
    });

    let income = new Prisma.Decimal(0);
    let expense = new Prisma.Decimal(0);

    for (const row of rows) {
      const signed =
        row.sourceType === 'REVERSAL' ? row.amount.negated() : row.amount;

      if (row.transactionType === FinanceTransactionType.INCOME) {
        income = income.add(signed);
      } else {
        expense = expense.add(signed);
      }
    }

    return {
      projectId: project.id,
      projectName: project.projectName,
      totalIncome: this.scope.decimalToString(income),
      totalExpense: this.scope.decimalToString(expense),
      net: this.scope.decimalToString(income.sub(expense)),
      asOf: new Date().toISOString(),
    };
  }

  private async aggregateIncomeExpense(
    companyId: string,
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    await this.scope.assertCompanyScope(companyId);

    const where = this.reportWhere(companyId, query, false, context);
    const rows = await this.prisma.financeTransaction.findMany({
      where,
      select: {
        transactionType: true,
        amount: true,
        sourceType: true,
      },
    });

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const row of rows) {
      const signed =
        row.sourceType === 'REVERSAL' ? row.amount.negated() : row.amount;

      if (row.transactionType === FinanceTransactionType.INCOME) {
        totalIncome = totalIncome.add(signed);
      } else if (row.transactionType === FinanceTransactionType.EXPENSE) {
        totalExpense = totalExpense.add(signed);
      }
    }

    return {
      asOf: new Date().toISOString(),
      totalIncome: this.scope.decimalToString(totalIncome),
      totalExpense: this.scope.decimalToString(totalExpense),
      net: this.scope.decimalToString(totalIncome.sub(totalExpense)),
      includedStatuses: this.resolveStatuses(query),
      filters: query,
    };
  }

  private async groupByField(
    field: 'categoryId' | 'departmentId' | 'projectId',
    query: FinanceReportQueryDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where = this.reportWhere(companyId, query, false, context);
    const rows = await this.prisma.financeTransaction.findMany({
      where: {
        ...where,
        [field]: { not: null },
      },
      select: {
        categoryId: true,
        departmentId: true,
        projectId: true,
        transactionType: true,
        amount: true,
        sourceType: true,
      },
    });

    const totals = new Map<
      string,
      { income: Prisma.Decimal; expense: Prisma.Decimal }
    >();

    for (const row of rows) {
      const key =
        field === 'categoryId'
          ? row.categoryId
          : field === 'departmentId'
            ? row.departmentId
            : row.projectId;

      if (!key) {
        continue;
      }
      const bucket = totals.get(key) ?? {
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
      };
      const signed =
        row.sourceType === 'REVERSAL' ? row.amount.negated() : row.amount;

      if (row.transactionType === FinanceTransactionType.INCOME) {
        bucket.income = bucket.income.add(signed);
      } else if (row.transactionType === FinanceTransactionType.EXPENSE) {
        bucket.expense = bucket.expense.add(signed);
      }

      totals.set(key, bucket);
    }

    return {
      asOf: new Date().toISOString(),
      items: [...totals.entries()].map(([id, values]) => ({
        id,
        totalIncome: this.scope.decimalToString(values.income),
        totalExpense: this.scope.decimalToString(values.expense),
        net: this.scope.decimalToString(values.income.sub(values.expense)),
      })),
      includedStatuses: this.resolveStatuses(query),
      filters: query,
    };
  }

  private reportWhere(
    companyId: string,
    query: FinanceReportQueryDto,
    includeTransfers: boolean,
    context: OfficeFinanceAccessContext,
  ): Prisma.FinanceTransactionWhereInput {
    const statuses = this.resolveStatuses(query);

    // Branch users are already constrained by the canonical transaction scope.
    // Do not let a caller-provided report filter replace that predicate with a
    // different Branch. Company-wide users may still filter a report by Branch.
    if (query.branchId) {
      this.scope.assertTransactionBranchScope(
        query.branchId,
        context,
        'Finance branch',
      );
    }

    return {
      ...this.scope.financeTransactionWhere(companyId, context),
      status: { in: statuses },
      ...(includeTransfers
        ? {}
        : {
            transactionType: {
              in: [
                FinanceTransactionType.INCOME,
                FinanceTransactionType.EXPENSE,
              ],
            },
          }),
      ...(query.fromDate || query.toDate
        ? {
            transactionDate: {
              ...(query.fromDate
                ? { gte: this.scope.parseDate(query.fromDate, 'fromDate') }
                : {}),
              ...(query.toDate
                ? { lte: this.scope.parseDate(query.toDate, 'toDate') }
                : {}),
            },
          }
        : {}),
      ...(query.branchId &&
      this.scope.canManageCompanyWideConfiguration(context)
        ? { branchId: query.branchId }
        : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.businessPartyId
        ? { businessPartyId: query.businessPartyId }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.paymentAccountId
        ? {
            OR: [
              { sourceAccountId: query.paymentAccountId },
              { destinationAccountId: query.paymentAccountId },
            ],
          }
        : {}),
    };
  }

  private resolveStatuses(
    query: FinanceReportQueryDto,
  ): FinanceTransactionStatus[] {
    if (!query.status?.trim()) {
      return [
        FinanceTransactionStatus.APPROVED,
        FinanceTransactionStatus.REVERSED,
      ];
    }

    const requested = query.status
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    const allowed = new Set(Object.values(FinanceTransactionStatus));
    const statuses = requested.filter(
      (value): value is FinanceTransactionStatus =>
        allowed.has(value as FinanceTransactionStatus),
    );

    return statuses.length
      ? statuses
      : [FinanceTransactionStatus.APPROVED, FinanceTransactionStatus.REVERSED];
  }
}
