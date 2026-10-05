import { Injectable } from '@nestjs/common';
import {
  FinanceActionEntityType,
  FinancePeriodStatus,
  FinanceTransactionStatus,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import { OFFICE_FINANCE_DELIVERY_EVENTS } from '../office-finance-delivery.events';
import { CreateFinancePeriodDto } from '../dto/finance-period.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { OfficeFinanceDeliveryService } from './office-finance-delivery.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { OfficeFinanceScopeService } from './office-finance-scope.service';
import { OfficeFinanceSettingsService } from './office-finance-settings.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class OfficeFinancePeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly mapper: FinanceResponseMapper,
    private readonly settings: OfficeFinanceSettingsService,
    private readonly delivery: OfficeFinanceDeliveryService,
  ) {}

  async findAll(context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const rows = await this.prisma.financePeriod.findMany({
      where: { companyId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    return rows.map((period) =>
      this.mapper.toPeriod(period, this.periodActions(period, context)),
    );
  }

  async findOne(id: string, context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const period = await this.prisma.financePeriod.findFirst({
      where: { id, companyId },
    });

    if (!period) {
      this.scope.notFound('Finance period');
    }

    return this.mapper.toPeriod(period, this.periodActions(period, context));
  }

  create(dto: CreateFinancePeriodDto, context: OfficeFinanceAccessContext) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_FINANCE_PERIOD',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);
        const profile = await this.settings.requireProfile(tx, companyId);

        const { periodStart, periodEnd } = this.monthBounds(
          dto.periodYear,
          dto.periodMonth,
        );

        if (periodStart < profile.reportingStartDate) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.VALIDATION_ERROR,
            'Period cannot start before reportingStartDate.',
          );
        }

        const created = await tx.financePeriod.create({
          data: {
            companyId,
            periodYear: dto.periodYear,
            periodMonth: dto.periodMonth,
            periodStart,
            periodEnd,
            createdByUserId: context.userId,
          },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: FinanceActionEntityType.PERIOD,
          entityId: created.id,
          action: 'CREATE',
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: 0,
          versionAfter: created.version,
        });

        return this.receipts.commandMeta('PERIOD', created.id);
      },
      (id) => this.findOne(id, context),
    );
  }

  lock(
    id: string,
    dto: VersionedCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertApprove(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'LOCK_FINANCE_PERIOD',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadPeriod(tx, id, companyId);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        if (current.status === FinancePeriodStatus.LOCKED) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_PERIOD_STATE_CHANGED,
            'Finance period is already locked.',
          );
        }

        const pending = await tx.financeTransaction.count({
          where: {
            companyId,
            transactionDate: {
              gte: current.periodStart,
              lte: current.periodEnd,
            },
            status: FinanceTransactionStatus.SUBMITTED,
          },
        });

        if (pending > 0) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_PERIOD_LOCKED,
            'Cannot lock period while submitted transactions await approval.',
          );
        }

        const result = await tx.financePeriod.updateMany({
          where: {
            id,
            companyId,
            version: current.version,
            status: FinancePeriodStatus.OPEN,
          },
          data: {
            status: FinancePeriodStatus.LOCKED,
            lockedByUserId: context.userId,
            lockedAt: new Date(),
            version: { increment: 1 },
          },
        });
        this.scope.assertVersionedUpdate(result, 'Finance period');
        const updated = await tx.financePeriod.findUniqueOrThrow({
          where: { id },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: FinanceActionEntityType.PERIOD,
          entityId: id,
          action: 'LOCK',
          fromStatus: current.status,
          toStatus: updated.status,
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: current.version,
          versionAfter: updated.version,
        });

        await this.delivery.writePeriodLifecycle(
          tx,
          updated,
          OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_LOCKED,
        );

        return this.receipts.commandMeta('PERIOD', id);
      },
      () => this.findOne(id, context),
    );
  }

  reopen(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertApprove(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'REOPEN_FINANCE_PERIOD',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadPeriod(tx, id, companyId);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        if (current.status !== FinancePeriodStatus.LOCKED) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_PERIOD_STATE_CHANGED,
            'Finance period is not locked.',
          );
        }

        const result = await tx.financePeriod.updateMany({
          where: {
            id,
            companyId,
            version: current.version,
            status: FinancePeriodStatus.LOCKED,
          },
          data: {
            status: FinancePeriodStatus.OPEN,
            reopenedByUserId: context.userId,
            reopenedAt: new Date(),
            reopenReason: dto.reason,
            version: { increment: 1 },
          },
        });
        this.scope.assertVersionedUpdate(result, 'Finance period');
        const updated = await tx.financePeriod.findUniqueOrThrow({
          where: { id },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: FinanceActionEntityType.PERIOD,
          entityId: id,
          action: 'REOPEN',
          fromStatus: current.status,
          toStatus: updated.status,
          actorUserId: context.userId,
          reason: dto.reason,
          operationId: dto.operationId,
          versionBefore: current.version,
          versionAfter: updated.version,
        });

        await this.delivery.writePeriodLifecycle(
          tx,
          updated,
          OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_REOPENED,
        );

        return this.receipts.commandMeta('PERIOD', id);
      },
      () => this.findOne(id, context),
    );
  }

  async assertOpenPeriodForDate(
    tx: DbClient,
    companyId: string,
    transactionDate: Date,
  ) {
    const [period] = await tx.$queryRaw<
      Array<{ id: string; status: FinancePeriodStatus }>
    >(
      Prisma.sql`
        SELECT id, status
        FROM finance_periods
        WHERE "companyId" = ${companyId}
          AND "periodStart" <= ${transactionDate}
          AND "periodEnd" >= ${transactionDate}
        ORDER BY "periodStart" ASC
        LIMIT 1
        FOR UPDATE
      `,
    );

    if (!period) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_PERIOD_NOT_CONFIGURED,
        'No finance period exists for the transaction date.',
      );
    }

    if (period.status === FinancePeriodStatus.LOCKED) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_PERIOD_LOCKED,
        'Finance period is locked.',
      );
    }

    return period;
  }

  private monthBounds(year: number, month: number) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    return { periodStart, periodEnd };
  }

  private periodActions(
    period: { status: FinancePeriodStatus; version: number },
    context: OfficeFinanceAccessContext,
  ) {
    const actions: string[] = [];
    const canSettings = context.permissions.includes(
      FINANCE_PERMISSIONS.SETTINGS_MANAGE,
    );
    const canApprove = context.permissions.includes(
      FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE,
    );

    if (!this.scope.canManageCompanyWideConfiguration(context)) {
      return [];
    }

    if (canSettings || canApprove) {
      if (period.status === FinancePeriodStatus.OPEN && canApprove) {
        actions.push('LOCK');
      }
      if (period.status === FinancePeriodStatus.LOCKED && canApprove) {
        actions.push('REOPEN');
      }
    }

    return actions;
  }

  private async loadPeriod(tx: DbClient, id: string, companyId: string) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM finance_periods
        WHERE id = ${id} AND "companyId" = ${companyId}
        FOR UPDATE
      `,
    );
    if (locked.length === 0) {
      this.scope.notFound('Finance period');
    }

    return tx.financePeriod.findUniqueOrThrow({ where: { id } });
  }

  private assertSettingsManage(context: OfficeFinanceAccessContext) {
    if (!context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.settings.manage is required',
      );
    }
    this.scope.assertCompanyWideMutationScope(context, 'Finance periods');
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
    this.scope.assertCompanyWideMutationScope(context, 'Finance periods');
  }
}
