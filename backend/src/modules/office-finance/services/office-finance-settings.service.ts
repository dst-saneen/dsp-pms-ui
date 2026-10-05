import { Injectable } from '@nestjs/common';
import {
  FinanceActionEntityType,
  FinanceCategoryType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import { UpdateFinancialProfileDto } from '../dto/financial-profile.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class OfficeFinanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly mapper: FinanceResponseMapper,
  ) {}

  async getSettings(context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const profile = await this.prisma.companyFinancialProfile.findUnique({
      where: { companyId },
    });

    if (!profile) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCIAL_PROFILE_NOT_CONFIGURED,
        'Financial profile is not configured for this Company.',
      );
    }

    const allowedActions =
      context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE) &&
      this.scope.canManageCompanyWideConfiguration(context)
        ? (['EDIT'] as const)
        : [];

    return this.mapper.toFinancialProfile(profile, [...allowedActions]);
  }

  updateSettings(
    dto: UpdateFinancialProfileDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_FINANCIAL_PROFILE',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        let current = await tx.companyFinancialProfile.findUnique({
          where: { companyId },
        });

        if (!current) {
          if (dto.expectedVersion !== 0) {
            throw new DomainConflictException(
              FINANCE_ERROR_CODES.FINANCIAL_PROFILE_NOT_CONFIGURED,
              'Financial profile is not configured for this Company.',
            );
          }

          current = await tx.companyFinancialProfile.create({
            data: {
              id: randomUUID(),
              companyId,
              baseCurrencyCode: dto.baseCurrencyCode.trim().toUpperCase(),
              reportingStartDate: this.scope.parseDate(
                dto.reportingStartDate,
                'reportingStartDate',
              ),
              payrollExpenseCategoryId: dto.payrollExpenseCategoryId ?? null,
              createdByUserId: context.userId,
              updatedByUserId: context.userId,
            },
          });

          await this.scope.recordActionEvent(tx, {
            companyId,
            entityType: FinanceActionEntityType.FINANCIAL_PROFILE,
            entityId: current.id,
            action: 'CREATE',
            fromStatus: null,
            toStatus: String(current.version),
            actorUserId: context.userId,
            operationId: dto.operationId,
            versionBefore: 0,
            versionAfter: current.version,
          });

          return this.receipts.commandMeta('FINANCIAL_PROFILE', current.id);
        }

        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const nextCurrency = dto.baseCurrencyCode.trim().toUpperCase();
        await this.assertCurrencyChangeAllowed(
          tx,
          companyId,
          current.baseCurrencyCode,
          nextCurrency,
        );

        if (dto.payrollExpenseCategoryId) {
          const category = await tx.financeCategory.findFirst({
            where: {
              id: dto.payrollExpenseCategoryId,
              companyId,
              categoryType: FinanceCategoryType.EXPENSE,
              archivedAt: null,
              isActive: true,
            },
            select: { id: true },
          });

          if (!category) {
            this.scope.notFound('Payroll expense category');
          }
        }

        const updated = await tx.companyFinancialProfile.update({
          where: { companyId },
          data: {
            baseCurrencyCode: nextCurrency,
            reportingStartDate: this.scope.parseDate(
              dto.reportingStartDate,
              'reportingStartDate',
            ),
            payrollExpenseCategoryId:
              dto.payrollExpenseCategoryId === undefined
                ? undefined
                : dto.payrollExpenseCategoryId,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: FinanceActionEntityType.FINANCIAL_PROFILE,
          entityId: updated.id,
          action: 'UPDATE',
          fromStatus: String(current.version),
          toStatus: String(updated.version),
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: current.version,
          versionAfter: updated.version,
        });

        return this.receipts.commandMeta('FINANCIAL_PROFILE', updated.id);
      },
      () => this.getSettings(context),
    );
  }

  async requireProfile(tx: DbClient, companyId: string) {
    const existing = await tx.companyFinancialProfile.findUnique({
      where: { companyId },
    });

    if (!existing) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCIAL_PROFILE_NOT_CONFIGURED,
        'Financial profile is not configured for this Company.',
      );
    }

    return existing;
  }

  /** @deprecated Use requireProfile. Never silently creates a USD profile. */
  async ensureProfile(tx: DbClient, companyId: string) {
    return this.requireProfile(tx, companyId);
  }

  private async assertCurrencyChangeAllowed(
    tx: DbClient,
    companyId: string,
    currentCurrency: string,
    nextCurrency: string,
  ) {
    if (currentCurrency === nextCurrency) {
      return;
    }

    const [mismatchedAccounts, mismatchedTransactions] = await Promise.all([
      tx.financePaymentAccount.count({
        where: {
          companyId,
          currencyCode: { not: nextCurrency },
        },
      }),
      tx.financeTransaction.count({
        where: {
          companyId,
          currencyCode: { not: nextCurrency },
        },
      }),
    ]);

    if (mismatchedAccounts > 0 || mismatchedTransactions > 0) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_CURRENCY_CHANGE_BLOCKED,
        'Cannot change base currency while payment accounts or transactions use a different currency.',
      );
    }
  }

  private assertSettingsManage(context: OfficeFinanceAccessContext) {
    if (!context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.settings.manage is required',
      );
    }
    this.scope.assertCompanyWideMutationScope(
      context,
      'Company financial profile',
    );
  }
}
