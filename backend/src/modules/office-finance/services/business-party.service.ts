import { Injectable } from '@nestjs/common';
import { FinanceActionEntityType, Prisma } from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NumberSeriesService } from '../../number-series';

import {
  CreateBusinessPartyDto,
  SearchBusinessPartyDto,
  UpdateBusinessPartyDto,
} from '../dto/business-party.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import { FinanceCapabilityService } from './finance-capability.service';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class BusinessPartyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly capabilities: FinanceCapabilityService,
    private readonly mapper: FinanceResponseMapper,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async findPage(
    query: SearchBusinessPartyDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where: Prisma.BusinessPartyWhereInput = {
      companyId,
      ...(query.keyword
        ? {
            OR: [
              { displayName: { contains: query.keyword, mode: 'insensitive' } },
              { partyCode: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;

    const [rows, total] = await Promise.all([
      this.prisma.businessParty.findMany({
        where,
        orderBy: { displayName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.businessParty.count({ where }),
    ]);

    return this.mapper.toPaginated(
      rows.map((party) =>
        this.mapper.toBusinessParty(
          party,
          this.capabilities.getTaxonomyAllowedActions(party, context),
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

    const party = await this.prisma.businessParty.findFirst({
      where: { id, companyId },
    });

    if (!party) {
      this.scope.notFound('Business party');
    }

    return this.mapper.toBusinessParty(
      party,
      this.capabilities.getTaxonomyAllowedActions(party, context),
    );
  }

  create(dto: CreateBusinessPartyDto, context: OfficeFinanceAccessContext) {
    this.assertCanCreateParty(dto.partyType, context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_BUSINESS_PARTY',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        const partyCode = await this.numberSeries.next(
          'BUSINESS_PARTY',
          companyId,
          'BP',
          6,
          tx,
        );

        const displayName = dto.displayName.trim();
        const created = await tx.businessParty.create({
          data: {
            companyId,
            partyCode,
            displayName,
            normalizedName: this.scope.normalizeName(displayName),
            partyType: dto.partyType,
            contactPerson: dto.contactPerson?.trim() || null,
            email: dto.email?.trim() || null,
            phone: dto.phone?.trim() || null,
            taxRegistrationRef: dto.taxRegistrationRef?.trim() || null,
            createdByUserId: context.userId,
          },
        });

        await this.recordPartyEvent(
          tx,
          created.companyId,
          created.id,
          'CREATE',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('BUSINESS_PARTY', created.id);
      },
      (id) => this.findOne(id, context),
    );
  }

  update(
    id: string,
    dto: UpdateBusinessPartyDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_BUSINESS_PARTY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadParty(tx, id, companyId);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const displayName = dto.displayName?.trim() ?? current.displayName;
        const updated = await tx.businessParty.update({
          where: { id },
          data: {
            displayName,
            normalizedName: this.scope.normalizeName(displayName),
            partyType: dto.partyType,
            contactPerson:
              dto.contactPerson === undefined
                ? undefined
                : dto.contactPerson?.trim() || null,
            email:
              dto.email === undefined ? undefined : dto.email?.trim() || null,
            phone:
              dto.phone === undefined ? undefined : dto.phone?.trim() || null,
            taxRegistrationRef:
              dto.taxRegistrationRef === undefined
                ? undefined
                : dto.taxRegistrationRef?.trim() || null,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordPartyEvent(
          tx,
          companyId,
          id,
          'UPDATE',
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('BUSINESS_PARTY', id);
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
      archive ? 'ARCHIVE_BUSINESS_PARTY' : 'REACTIVATE_BUSINESS_PARTY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadParty(tx, id, companyId);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const updated = await tx.businessParty.update({
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

        await this.recordPartyEvent(
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

        return this.receipts.commandMeta('BUSINESS_PARTY', id);
      },
      () => this.findOne(id, context),
    );
  }

  private async loadParty(tx: DbClient, id: string, companyId: string) {
    const party = await tx.businessParty.findFirst({
      where: { id, companyId },
    });

    if (!party) {
      this.scope.notFound('Business party');
    }

    return party;
  }

  private async recordPartyEvent(
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
      entityType: FinanceActionEntityType.BUSINESS_PARTY,
      entityId,
      action,
      actorUserId,
      operationId,
      versionBefore,
      versionAfter,
      reason,
    });
  }

  private assertCanCreateParty(
    partyType: CreateBusinessPartyDto['partyType'],
    context: OfficeFinanceAccessContext,
  ) {
    if (context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      return;
    }
    // Project managers / HR creating a Client project need to add a Customer
    // without full finance setup rights. Vendors still require finance settings.
    if (
      partyType === 'CUSTOMER' &&
      context.permissions.includes('projects.projects.manage')
    ) {
      return;
    }
    throw new DomainConflictException(
      FINANCE_ERROR_CODES.VALIDATION_ERROR,
      'Need finance.settings.manage, or projects.projects.manage to create a Customer for Client projects.',
    );
  }

  private assertSettingsManage(context: OfficeFinanceAccessContext) {
    if (!context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.settings.manage is required',
      );
    }
    this.scope.assertCompanyWideMutationScope(context, 'Business Parties');
  }
}
