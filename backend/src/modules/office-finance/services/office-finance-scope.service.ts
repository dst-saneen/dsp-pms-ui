import { Injectable } from '@nestjs/common';
import {
  FinanceActionEntityType,
  FinanceTransaction,
  FinanceTransactionStatus,
  FinanceTransactionType,
  Prisma,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import type {
  FinanceCalendarDateString,
  FinanceWarning,
  PaginatedResponse,
} from '../dto/finance-api.types';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { OfficeFinanceFeatureService } from './office-finance-feature.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class OfficeFinanceScopeService {
  constructor(
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly featureService: OfficeFinanceFeatureService,
  ) {}

  resolveCompanyId(context: OfficeFinanceAccessContext): string {
    if (context.isGlobal || !context.activeCompanyId) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.OFFICE_FINANCE_SCOPE_NOT_ENABLED,
        'Select a Company to use Finance.',
      );
    }

    return context.activeCompanyId;
  }

  async assertCompanyScope(companyId: string) {
    await this.organizationScope.assertCompanyInScope(companyId);
    if (!(await this.featureService.isEnabledForCompany(companyId))) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.OFFICE_FINANCE_SCOPE_NOT_ENABLED,
        'Finance is not enabled for this Company.',
      );
    }
  }

  /**
   * Finance transactions are operational records. A branch-scoped user may
   * only see records owned by their active Branch; Company-scoped users retain
   * the existing Company-wide view. Keep this predicate central so direct-ID
   * routes cannot accidentally bypass list filtering.
   */
  financeTransactionWhere(
    companyId: string,
    context: OfficeFinanceAccessContext,
  ): Prisma.FinanceTransactionWhereInput {
    if (!this.isBranchScoped(context)) {
      return { companyId };
    }

    if (!context.activeBranchId) {
      return { companyId, id: '__no_branch_scope__' };
    }

    return { companyId, branchId: context.activeBranchId };
  }

  /**
   * Payment accounts can deliberately be Company-wide (branchId = null).
   * They are safe to reference from a Branch, but accounts owned by another
   * Branch must never be discoverable through a direct ID or a list route.
   */
  financePaymentAccountWhere(
    companyId: string,
    context: OfficeFinanceAccessContext,
  ): Prisma.FinancePaymentAccountWhereInput {
    if (!this.isBranchScoped(context)) {
      return { companyId };
    }

    if (!context.activeBranchId) {
      return { companyId, id: '__no_branch_scope__' };
    }

    return {
      companyId,
      AND: [
        {
          OR: [{ branchId: context.activeBranchId }, { branchId: null }],
        },
      ],
    };
  }

  /** Mutating an account or exposing its aggregate balance needs an owned Branch. */
  financeBranchOwnedPaymentAccountWhere(
    companyId: string,
    context: OfficeFinanceAccessContext,
  ): Prisma.FinancePaymentAccountWhereInput {
    if (!this.isBranchScoped(context)) {
      return { companyId };
    }

    return {
      companyId,
      branchId: context.activeBranchId ?? '__no_branch_scope__',
    };
  }

  /** Project drill-downs follow the same active-Branch boundary as transactions. */
  financeProjectWhere(
    companyId: string,
    context: OfficeFinanceAccessContext,
  ): Prisma.ProjectWhereInput {
    if (!this.isBranchScoped(context)) {
      return { companyId };
    }

    return {
      companyId,
      branchId: context.activeBranchId ?? '__no_branch_scope__',
    };
  }

  /**
   * A branch-scoped actor must never create or reclassify an operational
   * transaction outside the active Branch. This intentionally rejects null
   * branch transactions as well: those are Company-wide records.
   */
  assertTransactionBranchScope(
    branchId: string | null | undefined,
    context: OfficeFinanceAccessContext,
    entityLabel = 'Finance transaction',
  ) {
    if (
      this.isBranchScoped(context) &&
      (!context.activeBranchId || branchId !== context.activeBranchId)
    ) {
      this.notFound(entityLabel);
    }
  }

  /** Company-wide configuration must not be mutated by a Branch role. */
  assertCompanyWideMutationScope(
    context: OfficeFinanceAccessContext,
    entityLabel = 'Finance configuration',
  ) {
    if (this.isBranchScoped(context)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        `${entityLabel} requires Company-wide Finance access.`,
      );
    }
  }

  canManageCompanyWideConfiguration(context: OfficeFinanceAccessContext) {
    return !this.isBranchScoped(context);
  }

  private isBranchScoped(context: OfficeFinanceAccessContext) {
    return !context.isGlobal && context.scopeLevel === 'BRANCH';
  }

  assertExpectedVersion(current: number, expected?: number) {
    if (expected === undefined || expected === null) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'expectedVersion is required',
      );
    }

    if (current !== expected) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_VERSION_CONFLICT,
        'Record version has changed. Refresh and retry.',
      );
    }
  }

  assertVersionedUpdate<T extends { count: number }>(
    result: T,
    entityLabel: string,
  ) {
    if (result.count === 0) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_STATE_CHANGED,
        `${entityLabel} state has changed. Refresh and retry.`,
      );
    }
  }

  notFound(entityLabel = 'Finance resource'): never {
    throw new DomainNotFoundException(
      FINANCE_ERROR_CODES.FINANCE_RESOURCE_NOT_FOUND,
      `${entityLabel} not found`,
    );
  }

  formatDate(value: Date): FinanceCalendarDateString {
    return value.toISOString().slice(0, 10);
  }

  parseDate(value: string, fieldName: string): Date {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        `${fieldName} must be YYYY-MM-DD`,
      );
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        `${fieldName} is invalid`,
      );
    }

    return parsed;
  }

  parseMoney(value: string, fieldName: string): Prisma.Decimal {
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        `${fieldName} must be a decimal string with up to two fractional digits`,
      );
    }

    return new Prisma.Decimal(trimmed);
  }

  decimalToString(value: Prisma.Decimal | null | undefined): string {
    if (value == null) {
      return '0.00';
    }

    return value.toFixed(2);
  }

  normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  toPaginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return { items, total, page, limit };
  }

  async recordActionEvent(
    tx: DbClient,
    input: {
      companyId: string;
      entityType: FinanceActionEntityType;
      entityId: string;
      action: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      actorUserId: string;
      reason?: string | null;
      operationId: string;
      versionBefore: number;
      versionAfter: number;
      reversalTransactionId?: string | null;
    },
  ) {
    await tx.financeActionEvent.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorUserId: input.actorUserId,
        reason: input.reason ?? null,
        operationId: input.operationId,
        versionBefore: input.versionBefore,
        versionAfter: input.versionAfter,
        reversalTransactionId: input.reversalTransactionId ?? null,
      },
    });
  }

  /**
   * Canonical payment-account lock order: ascending ID.
   * Call before opening-balance mutation or approved movement creation.
   */
  async lockPaymentAccountsForUpdate(
    tx: DbClient,
    accountIds: Array<string | null | undefined>,
  ): Promise<string[]> {
    const ids = [
      ...new Set(
        accountIds.filter((id): id is string => typeof id === 'string' && !!id),
      ),
    ].sort();

    for (const id of ids) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM finance_payment_accounts WHERE id = ${id} FOR UPDATE`,
      );
    }

    return ids;
  }

  signedMovementAmount(
    transaction: Pick<
      FinanceTransaction,
      | 'transactionType'
      | 'amount'
      | 'status'
      | 'sourceType'
      | 'reversalOfTransactionId'
    >,
    accountRole: 'source' | 'destination',
  ): Prisma.Decimal | null {
    if (
      transaction.status !== FinanceTransactionStatus.APPROVED &&
      transaction.status !== FinanceTransactionStatus.REVERSED
    ) {
      return null;
    }

    const amount = transaction.amount;
    let signed: Prisma.Decimal | null = null;

    switch (transaction.transactionType) {
      case FinanceTransactionType.INCOME:
        signed = accountRole === 'destination' ? amount : null;
        break;
      case FinanceTransactionType.EXPENSE:
        signed = accountRole === 'source' ? amount.negated() : null;
        break;
      case FinanceTransactionType.TRANSFER:
        signed =
          accountRole === 'source'
            ? amount.negated()
            : accountRole === 'destination'
              ? amount
              : null;
        break;
      default:
        signed = null;
    }

    if (!signed) {
      return null;
    }

    if (transaction.sourceType === 'REVERSAL') {
      return signed.negated();
    }

    return signed;
  }

  buildTransactionWarnings(
    transaction: Pick<
      FinanceTransaction,
      'transactionType' | 'amount' | 'status'
    >,
  ): FinanceWarning[] {
    const warnings: FinanceWarning[] = [];

    if (transaction.amount.lessThanOrEqualTo(0)) {
      warnings.push({
        code: 'NON_POSITIVE_AMOUNT',
        message: 'Transaction amount must be positive.',
      });
    }

    return warnings;
  }
}
