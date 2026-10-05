import { Injectable } from '@nestjs/common';
import { FinanceActionEntityType, Prisma } from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NumberSeriesService } from '../../number-series';

import {
  CreateFinanceCategoryDto,
  SearchFinanceCategoryDto,
  UpdateFinanceCategoryDto,
} from '../dto/finance-category.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import { FinanceCapabilityService } from './finance-capability.service';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class OfficeFinanceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly capabilities: FinanceCapabilityService,
    private readonly mapper: FinanceResponseMapper,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async findPage(
    query: SearchFinanceCategoryDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where: Prisma.FinanceCategoryWhereInput = {
      companyId,
      ...(query.categoryType ? { categoryType: query.categoryType } : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                categoryName: { contains: query.keyword, mode: 'insensitive' },
              },
              {
                categoryCode: { contains: query.keyword, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;

    const [rows, total] = await Promise.all([
      this.prisma.financeCategory.findMany({
        where,
        orderBy: { categoryName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financeCategory.count({ where }),
    ]);

    return this.mapper.toPaginated(
      rows.map((category) =>
        this.mapper.toCategory(
          category,
          this.capabilities.getTaxonomyAllowedActions(category, context),
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const category = await this.prisma.financeCategory.findFirst({
      where: { id, companyId },
    });

    if (!category) {
      this.scope.notFound('Finance category');
    }

    return this.mapper.toCategory(
      category,
      this.capabilities.getTaxonomyAllowedActions(category, context),
    );
  }

  create(dto: CreateFinanceCategoryDto, context: OfficeFinanceAccessContext) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_FINANCE_CATEGORY',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        const prefix = dto.categoryType === 'INCOME' ? 'IN' : 'EX';
        const categoryCode = await this.numberSeries.next(
          'FINANCE_TRANSACTION',
          `${companyId}:${prefix}`,
          prefix,
          6,
          tx,
        );

        const created = await tx.financeCategory.create({
          data: {
            companyId,
            categoryCode,
            categoryName: dto.categoryName.trim(),
            categoryType: dto.categoryType,
            description: dto.description?.trim() || null,
            createdByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          created.id,
          'CREATE',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('CATEGORY', created.id);
      },
      (id) => this.findOne(id, context),
    );
  }

  update(
    id: string,
    dto: UpdateFinanceCategoryDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_FINANCE_CATEGORY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadCategory(tx, id, companyId);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const updated = await tx.financeCategory.update({
          where: { id },
          data: {
            categoryName: dto.categoryName?.trim(),
            description:
              dto.description === undefined
                ? undefined
                : dto.description?.trim() || null,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          'UPDATE',
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('CATEGORY', id);
      },
      () => this.findOne(id, context),
    );
  }

  archive(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    return this.setArchiveState(id, dto, context, true);
  }

  reactivate(
    id: string,
    dto: VersionedCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    return this.setArchiveState(
      id,
      { ...dto, reason: 'Reactivated' },
      context,
      false,
    );
  }

  private setArchiveState(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
    archive: boolean,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      archive ? 'ARCHIVE_FINANCE_CATEGORY' : 'REACTIVATE_FINANCE_CATEGORY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadCategory(tx, id, companyId);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const updated = await tx.financeCategory.update({
          where: { id },
          data: archive
            ? {
                isActive: false,
                archivedAt: new Date(),
                archivedByUserId: context.userId,
                archiveReason: dto.reason,
                version: { increment: 1 },
                updatedByUserId: context.userId,
              }
            : {
                isActive: true,
                archivedAt: null,
                archivedByUserId: null,
                archiveReason: null,
                version: { increment: 1 },
                updatedByUserId: context.userId,
              },
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          archive ? 'ARCHIVE' : 'REACTIVATE',
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        return this.receipts.commandMeta('CATEGORY', id);
      },
      () => this.findOne(id, context),
    );
  }

  private async loadCategory(tx: DbClient, id: string, companyId: string) {
    const category = await tx.financeCategory.findFirst({
      where: { id, companyId },
    });

    if (!category) {
      this.scope.notFound('Finance category');
    }

    return category;
  }

  private async recordEvent(
    tx: DbClient,
    companyId: string,
    entityId: string,
    action: string,
    versionBefore: number,
    versionAfter: number,
    operationId: string,
    actorUserId: string,
    reason?: string,
  ) {
    await this.scope.recordActionEvent(tx, {
      companyId,
      entityType: FinanceActionEntityType.CATEGORY,
      entityId,
      action,
      actorUserId,
      operationId,
      versionBefore,
      versionAfter,
      reason,
    });
  }

  private assertSettingsManage(context: OfficeFinanceAccessContext) {
    if (!context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.settings.manage is required',
      );
    }
    this.scope.assertCompanyWideMutationScope(context, 'Finance categories');
  }
}
