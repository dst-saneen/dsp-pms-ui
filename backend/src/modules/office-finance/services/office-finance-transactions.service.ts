import { Injectable } from '@nestjs/common';
import {
  FinanceActionEntityType,
  FinanceSourceType,
  FinanceTransaction,
  FinanceTransactionStatus,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NumberSeriesService } from '../../number-series';

import { OFFICE_FINANCE_DELIVERY_EVENTS } from '../office-finance-delivery.events';
import {
  CreateFinanceTransactionDto,
  SearchFinanceTransactionDto,
  UpdateFinanceTransactionDto,
} from '../dto/finance-transaction.dto';
import { VersionedReasonCommandDto } from '../dto/versioned-command.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import { FinanceCapabilityService } from './finance-capability.service';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { OfficeFinanceDeliveryService } from './office-finance-delivery.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { FinanceTransactionValidatorService } from './finance-transaction-validator.service';
import { OfficeFinancePeriodsService } from './office-finance-periods.service';
import { OfficeFinanceScopeService } from './office-finance-scope.service';
import { OfficeFinanceSettingsService } from './office-finance-settings.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class OfficeFinanceTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly capabilities: FinanceCapabilityService,
    private readonly mapper: FinanceResponseMapper,
    private readonly numberSeries: NumberSeriesService,
    private readonly settings: OfficeFinanceSettingsService,
    private readonly periods: OfficeFinancePeriodsService,
    private readonly validator: FinanceTransactionValidatorService,
    private readonly delivery: OfficeFinanceDeliveryService,
  ) {}

  async findPage(
    query: SearchFinanceTransactionDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where: Prisma.FinanceTransactionWhereInput = {
      ...this.scope.financeTransactionWhere(companyId, context),
      ...(query.status
        ? { status: query.status as FinanceTransactionStatus }
        : {}),
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
      ...(query.keyword
        ? {
            OR: [
              {
                transactionNumber: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
              { description: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;

    const [rows, total] = await Promise.all([
      this.prisma.financeTransaction.findMany({
        where,
        orderBy: [{ transactionDate: 'desc' }, { transactionNumber: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financeTransaction.count({ where }),
    ]);

    return this.mapper.toPaginated(
      rows.map((transaction) => this.toProjection(transaction, context)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const transaction = await this.prisma.financeTransaction.findFirst({
      where: { id, ...this.scope.financeTransactionWhere(companyId, context) },
    });

    if (!transaction) {
      this.scope.notFound('Finance transaction');
    }

    return this.toProjection(transaction, context);
  }

  async findHistory(id: string, context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const transaction = await this.prisma.financeTransaction.findFirst({
      where: { id, ...this.scope.financeTransactionWhere(companyId, context) },
      select: { id: true },
    });

    if (!transaction) {
      this.scope.notFound('Finance transaction');
    }

    const events = await this.prisma.financeActionEvent.findMany({
      where: {
        companyId,
        entityType: FinanceActionEntityType.TRANSACTION,
        entityId: id,
      },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((event) => ({
      id: event.id,
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorUserId: event.actorUserId,
      reason: event.reason,
      operationId: event.operationId,
      versionBefore: event.versionBefore,
      versionAfter: event.versionAfter,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  create(
    dto: CreateFinanceTransactionDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_FINANCE_TRANSACTION',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);
        const profile = await this.settings.requireProfile(tx, companyId);

        const transactionDate = this.scope.parseDate(
          dto.transactionDate,
          'transactionDate',
        );
        const amount = this.scope.parseMoney(dto.amount, 'amount');
        const taxAmount = this.scope.parseMoney(
          dto.taxAmount ?? '0',
          'taxAmount',
        );

        const branchId = await this.validator.validateMerged(tx, companyId, {
          transactionType: dto.transactionType,
          transactionDate,
          amount,
          taxAmount,
          currencyCode: profile.baseCurrencyCode,
          categoryId: dto.categoryId ?? null,
          sourceAccountId: dto.sourceAccountId ?? null,
          destinationAccountId: dto.destinationAccountId ?? null,
          businessPartyId: dto.businessPartyId ?? null,
          employeeId: dto.employeeId ?? null,
          departmentId: dto.departmentId ?? null,
          projectId: dto.projectId ?? null,
          sourceType: FinanceSourceType.MANUAL,
          description: dto.description,
        });
        this.scope.assertTransactionBranchScope(branchId, context);

        const transactionNumber = await this.numberSeries.next(
          'FINANCE_TRANSACTION',
          companyId,
          'FT',
          6,
          tx,
        );

        const created = await tx.financeTransaction.create({
          data: {
            companyId,
            branchId,
            transactionNumber,
            transactionDate,
            transactionType: dto.transactionType,
            status: FinanceTransactionStatus.DRAFT,
            amount,
            taxAmount,
            currencyCode: profile.baseCurrencyCode,
            categoryId: dto.categoryId ?? null,
            sourceAccountId: dto.sourceAccountId ?? null,
            destinationAccountId: dto.destinationAccountId ?? null,
            businessPartyId: dto.businessPartyId ?? null,
            employeeId: dto.employeeId ?? null,
            departmentId: dto.departmentId ?? null,
            projectId: dto.projectId ?? null,
            description: dto.description.trim(),
            reference: dto.reference?.trim() || null,
            sourceType: FinanceSourceType.MANUAL,
            createdByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          created.id,
          'CREATE',
          null,
          created.status,
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('TRANSACTION', created.id, {
          version: created.version,
          status: created.status,
        });
      },
      (id) => this.findOne(id, context),
    );
  }

  update(
    id: string,
    dto: UpdateFinanceTransactionDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_FINANCE_TRANSACTION',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadEditable(tx, id, companyId, context);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const transactionDate =
          dto.transactionDate === undefined
            ? current.transactionDate
            : this.scope.parseDate(dto.transactionDate, 'transactionDate');
        const amount =
          dto.amount === undefined
            ? current.amount
            : this.scope.parseMoney(dto.amount, 'amount');
        const taxAmount =
          dto.taxAmount === undefined
            ? current.taxAmount
            : this.scope.parseMoney(dto.taxAmount, 'taxAmount');

        const merged = {
          transactionType: current.transactionType,
          transactionDate,
          amount,
          taxAmount,
          currencyCode: current.currencyCode,
          categoryId:
            dto.categoryId === undefined ? current.categoryId : dto.categoryId,
          sourceAccountId:
            dto.sourceAccountId === undefined
              ? current.sourceAccountId
              : dto.sourceAccountId,
          destinationAccountId:
            dto.destinationAccountId === undefined
              ? current.destinationAccountId
              : dto.destinationAccountId,
          businessPartyId:
            dto.businessPartyId === undefined
              ? current.businessPartyId
              : dto.businessPartyId,
          employeeId:
            dto.employeeId === undefined ? current.employeeId : dto.employeeId,
          departmentId:
            dto.departmentId === undefined
              ? current.departmentId
              : dto.departmentId,
          projectId:
            dto.projectId === undefined ? current.projectId : dto.projectId,
          sourceType: current.sourceType,
          description:
            dto.description === undefined
              ? current.description
              : dto.description.trim(),
        };

        const branchId = await this.validator.validateMerged(
          tx,
          companyId,
          merged,
        );
        this.scope.assertTransactionBranchScope(branchId, context);

        const result = await tx.financeTransaction.updateMany({
          where: {
            id,
            companyId,
            version: current.version,
            status: current.status,
          },
          data: {
            transactionDate: merged.transactionDate,
            amount: merged.amount,
            taxAmount: merged.taxAmount,
            categoryId: merged.categoryId,
            sourceAccountId: merged.sourceAccountId,
            destinationAccountId: merged.destinationAccountId,
            businessPartyId: merged.businessPartyId,
            employeeId: merged.employeeId,
            departmentId: merged.departmentId,
            projectId: merged.projectId,
            branchId,
            description: merged.description,
            reference:
              dto.reference === undefined
                ? undefined
                : dto.reference?.trim() || null,
            version: { increment: 1 },
          },
        });

        this.scope.assertVersionedUpdate(result, 'Finance transaction');

        const updated = await tx.financeTransaction.findUniqueOrThrow({
          where: { id },
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          'UPDATE',
          current.status,
          updated.status,
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('TRANSACTION', id, {
          version: updated.version,
          status: updated.status,
        });
      },
      () => this.findOne(id, context),
    );
  }

  submit(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    return this.transition(
      id,
      dto,
      context,
      'SUBMIT',
      async (tx, current) => {
        const branchId = await this.validator.validateMerged(
          tx,
          current.companyId,
          {
            transactionType: current.transactionType,
            transactionDate: current.transactionDate,
            amount: current.amount,
            taxAmount: current.taxAmount,
            currencyCode: current.currencyCode,
            categoryId: current.categoryId,
            sourceAccountId: current.sourceAccountId,
            destinationAccountId: current.destinationAccountId,
            businessPartyId: current.businessPartyId,
            employeeId: current.employeeId,
            departmentId: current.departmentId,
            projectId: current.projectId,
            sourceType: current.sourceType,
            description: current.description,
          },
        );
        this.scope.assertTransactionBranchScope(branchId, context);

        return this.casTransitionUpdate(tx, current, {
          status: FinanceTransactionStatus.SUBMITTED,
          branchId,
          submittedByUserId: context.userId,
          submittedAt: new Date(),
        });
      },
      FinanceTransactionStatus.DRAFT,
    );
  }

  approve(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertApprove(context);

    return this.receipts.execute(
      context,
      this.scope.resolveCompanyId(context),
      'APPROVE_FINANCE_TRANSACTION',
      { id, ...dto },
      async (tx) => {
        const companyId = this.scope.resolveCompanyId(context);
        const current = await this.loadTransitionTarget(
          tx,
          id,
          companyId,
          FinanceTransactionStatus.SUBMITTED,
          context,
        );
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        if (
          current.createdByUserId === context.userId ||
          current.submittedByUserId === context.userId
        ) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_SELF_APPROVAL_FORBIDDEN,
            'Transaction creator or submitter cannot approve their own submission.',
          );
        }

        await this.scope.lockPaymentAccountsForUpdate(tx, [
          current.sourceAccountId,
          current.destinationAccountId,
        ]);

        const branchId = await this.validator.validateMerged(tx, companyId, {
          transactionType: current.transactionType,
          transactionDate: current.transactionDate,
          amount: current.amount,
          taxAmount: current.taxAmount,
          currencyCode: current.currencyCode,
          categoryId: current.categoryId,
          sourceAccountId: current.sourceAccountId,
          destinationAccountId: current.destinationAccountId,
          businessPartyId: current.businessPartyId,
          employeeId: current.employeeId,
          departmentId: current.departmentId,
          projectId: current.projectId,
          sourceType: current.sourceType,
          description: current.description,
        });
        this.scope.assertTransactionBranchScope(branchId, context);

        const updated = await this.casTransitionUpdate(tx, current, {
          status: FinanceTransactionStatus.APPROVED,
          branchId,
          approvedByUserId: context.userId,
          approvedAt: new Date(),
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          'APPROVE',
          current.status,
          updated.status,
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        await this.delivery.writeTransactionLifecycle(
          tx,
          updated,
          OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_APPROVED,
        );

        return this.receipts.commandMeta('TRANSACTION', id, {
          version: updated.version,
          status: updated.status,
        });
      },
      () => this.findOne(id, context),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  returnToDraft(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertApprove(context);

    return this.transition(
      id,
      dto,
      context,
      'RETURN',
      async (tx, current) => {
        if (!dto.reason?.trim()) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.VALIDATION_ERROR,
            'reason is required',
          );
        }

        return this.casTransitionUpdate(tx, current, {
          status: FinanceTransactionStatus.DRAFT,
          returnedByUserId: context.userId,
          returnedAt: new Date(),
          returnReason: dto.reason,
        });
      },
      FinanceTransactionStatus.SUBMITTED,
    );
  }

  cancel(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertManage(context);

    return this.transition(id, dto, context, 'CANCEL', async (tx, current) => {
      if (!dto.reason?.trim()) {
        throw new DomainConflictException(
          FINANCE_ERROR_CODES.VALIDATION_ERROR,
          'reason is required',
        );
      }

      return this.casTransitionUpdate(tx, current, {
        status: FinanceTransactionStatus.CANCELLED,
        cancelledByUserId: context.userId,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      });
    });
  }

  reverse(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertReverse(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'REVERSE_FINANCE_TRANSACTION',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadTransitionTarget(
          tx,
          id,
          companyId,
          FinanceTransactionStatus.APPROVED,
          context,
        );
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        if (!dto.reason?.trim()) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.VALIDATION_ERROR,
            'reason is required',
          );
        }

        if (current.sourceType !== FinanceSourceType.MANUAL) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
            'Only manual approved transactions can be reversed.',
          );
        }

        await this.scope.lockPaymentAccountsForUpdate(tx, [
          current.sourceAccountId,
          current.destinationAccountId,
        ]);

        const locked = await tx.financeTransaction.findFirst({
          where: {
            id,
            ...this.scope.financeTransactionWhere(companyId, context),
            status: FinanceTransactionStatus.APPROVED,
          },
        });

        if (!locked || locked.version !== current.version) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_STATE_CHANGED,
            'Finance transaction state has changed.',
          );
        }

        if (locked.reversedByTransactionId) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_REVERSAL_EXISTS,
            'Transaction has already been reversed.',
          );
        }

        await this.periods.assertOpenPeriodForDate(
          tx,
          companyId,
          locked.transactionDate,
        );

        const branchId = await this.validator.validateMerged(tx, companyId, {
          transactionType: locked.transactionType,
          transactionDate: locked.transactionDate,
          amount: locked.amount,
          taxAmount: locked.taxAmount,
          currencyCode: locked.currencyCode,
          categoryId: locked.categoryId,
          sourceAccountId: locked.sourceAccountId,
          destinationAccountId: locked.destinationAccountId,
          businessPartyId: locked.businessPartyId,
          employeeId: locked.employeeId,
          departmentId: locked.departmentId,
          projectId: locked.projectId,
          sourceType: locked.sourceType,
          description: locked.description,
        });
        this.scope.assertTransactionBranchScope(branchId, context);

        const reversalNumber = await this.numberSeries.next(
          'FINANCE_TRANSACTION',
          companyId,
          'FT',
          6,
          tx,
        );

        const now = new Date();
        const reversal = await tx.financeTransaction.create({
          data: {
            companyId: locked.companyId,
            branchId,
            transactionNumber: reversalNumber,
            transactionDate: locked.transactionDate,
            transactionType: locked.transactionType,
            status: FinanceTransactionStatus.APPROVED,
            amount: locked.amount,
            taxAmount: locked.taxAmount,
            currencyCode: locked.currencyCode,
            categoryId: locked.categoryId,
            departmentId: locked.departmentId,
            projectId: locked.projectId,
            sourceAccountId: locked.sourceAccountId,
            destinationAccountId: locked.destinationAccountId,
            businessPartyId: locked.businessPartyId,
            employeeId: locked.employeeId,
            description: `Reversal of ${locked.transactionNumber}`,
            reference: locked.reference,
            sourceType: FinanceSourceType.REVERSAL,
            sourceId: locked.id,
            reversalOfTransactionId: locked.id,
            // Same actor on both sides is intentional for REVERSAL rows;
            // DB maker-checker trigger will exempt structurally valid REVERSAL.
            createdByUserId: context.userId,
            approvedByUserId: context.userId,
            approvedAt: now,
            reversedByUserId: context.userId,
            reversedAt: now,
            reverseReason: dto.reason,
          },
        });

        const cas = await tx.financeTransaction.updateMany({
          where: {
            id,
            companyId,
            version: locked.version,
            status: FinanceTransactionStatus.APPROVED,
          },
          data: {
            status: FinanceTransactionStatus.REVERSED,
            reversedByTransactionId: reversal.id,
            reversedByUserId: context.userId,
            reversedAt: now,
            reverseReason: dto.reason,
            branchId,
            version: { increment: 1 },
          },
        });

        this.scope.assertVersionedUpdate(cas, 'Finance transaction');

        const updatedOriginal = await tx.financeTransaction.findUniqueOrThrow({
          where: { id },
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          'REVERSE',
          locked.status,
          updatedOriginal.status,
          locked.version,
          updatedOriginal.version,
          dto.operationId,
          context.userId,
          dto.reason,
          reversal.id,
        );

        await this.recordEvent(
          tx,
          companyId,
          reversal.id,
          'CREATE_REVERSAL',
          null,
          reversal.status,
          0,
          reversal.version,
          dto.operationId,
          context.userId,
          dto.reason,
          locked.id,
        );

        await this.delivery.writeTransactionLifecycle(
          tx,
          updatedOriginal,
          OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_REVERSED,
        );

        return this.receipts.commandMeta('TRANSACTION', id, {
          version: updatedOriginal.version,
          status: updatedOriginal.status,
        });
      },
      () => this.findOne(id, context),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private transition(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
    action: string,
    mutate: (
      tx: DbClient,
      current: Awaited<ReturnType<typeof this.loadEditable>>,
    ) => Promise<
      Pick<
        FinanceTransaction,
        'id' | 'companyId' | 'branchId' | 'status' | 'version'
      >
    >,
    requiredStatus?: FinanceTransactionStatus,
  ) {
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      `${action}_FINANCE_TRANSACTION`,
      { id, ...dto },
      async (tx) => {
        const current = requiredStatus
          ? await this.loadTransitionTarget(
              tx,
              id,
              companyId,
              requiredStatus,
              context,
            )
          : await this.loadEditable(tx, id, companyId, context);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const updated = await mutate(tx, current);

        await this.recordEvent(
          tx,
          companyId,
          id,
          action,
          current.status,
          updated.status,
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        const deliveryEventType = this.transactionDeliveryEventFor(action);
        if (deliveryEventType) {
          await this.delivery.writeTransactionLifecycle(
            tx,
            updated,
            deliveryEventType,
          );
        }

        return this.receipts.commandMeta('TRANSACTION', id, {
          version: updated.version,
          status: updated.status,
        });
      },
      () => this.findOne(id, context),
    );
  }

  private async casTransitionUpdate(
    tx: DbClient,
    current: Awaited<ReturnType<typeof this.loadEditable>>,
    data: Prisma.FinanceTransactionUncheckedUpdateManyInput,
  ) {
    const result = await tx.financeTransaction.updateMany({
      where: {
        id: current.id,
        companyId: current.companyId,
        version: current.version,
        status: current.status,
      },
      data: { ...data, version: { increment: 1 } },
    });
    this.scope.assertVersionedUpdate(result, 'Finance transaction');
    return tx.financeTransaction.findUniqueOrThrow({
      where: { id: current.id },
    });
  }

  private transactionDeliveryEventFor(action: string) {
    switch (action) {
      case 'SUBMIT':
        return OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_SUBMITTED;
      case 'RETURN':
        return OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_RETURNED;
      case 'CANCEL':
        return OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_CANCELLED;
      default:
        return null;
    }
  }

  private toProjection(
    transaction: Awaited<
      ReturnType<typeof this.prisma.financeTransaction.findFirst>
    > &
      object,
    context: OfficeFinanceAccessContext,
  ) {
    return this.mapper.toTransaction(
      transaction,
      this.capabilities.getTransactionAllowedActions(transaction, context),
    );
  }

  private async loadEditable(
    tx: DbClient,
    id: string,
    companyId: string,
    context: OfficeFinanceAccessContext,
  ) {
    const transaction = await tx.financeTransaction.findFirst({
      where: { id, ...this.scope.financeTransactionWhere(companyId, context) },
    });

    if (!transaction) {
      this.scope.notFound('Finance transaction');
    }

    if (
      transaction.status !== FinanceTransactionStatus.DRAFT &&
      transaction.status !== FinanceTransactionStatus.SUBMITTED
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_STATE_CHANGED,
        'Transaction is not editable.',
      );
    }

    return transaction;
  }

  private async loadTransitionTarget(
    tx: DbClient,
    id: string,
    companyId: string,
    status: FinanceTransactionStatus,
    context: OfficeFinanceAccessContext,
  ) {
    const transaction = await tx.financeTransaction.findFirst({
      where: { id, ...this.scope.financeTransactionWhere(companyId, context) },
    });

    if (!transaction) {
      this.scope.notFound('Finance transaction');
    }

    if (transaction.status !== status) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_STATE_CHANGED,
        'Finance transaction state has changed.',
      );
    }

    return transaction;
  }

  private async recordEvent(
    tx: DbClient,
    companyId: string,
    entityId: string,
    action: string,
    fromStatus: string | null,
    toStatus: string | null,
    versionBefore: number,
    versionAfter: number,
    operationId: string,
    actorUserId: string,
    reason?: string,
    reversalTransactionId?: string,
  ) {
    await this.scope.recordActionEvent(tx, {
      companyId,
      entityType: FinanceActionEntityType.TRANSACTION,
      entityId,
      action,
      fromStatus,
      toStatus,
      actorUserId,
      reason,
      operationId,
      versionBefore,
      versionAfter,
      reversalTransactionId,
    });
  }

  private assertManage(context: OfficeFinanceAccessContext) {
    if (
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE)
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.transactions.manage is required',
      );
    }
  }

  private assertApprove(context: OfficeFinanceAccessContext) {
    if (
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE)
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.transactions.approve is required',
      );
    }
  }

  private assertReverse(context: OfficeFinanceAccessContext) {
    if (
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_REVERSE)
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.transactions.reverse is required',
      );
    }
  }
}
