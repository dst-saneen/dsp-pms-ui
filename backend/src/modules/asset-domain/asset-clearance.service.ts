import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssetClearanceItemStatus,
  AssetClearanceWaiverStatus,
  Prisma,
} from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetCapabilityService } from './asset-capability.service';
import { AssetCustodyService } from './asset-custody.service';
import { AssetIdempotencyService } from './asset-idempotency.service';
import {
  ASSET_NOTIFICATION_EVENT,
  AssetNotificationService,
} from './asset-notification.service';
import { AssetResponseMapper } from './asset-response.mapper';
import {
  ApproveAssetClearanceWaiverDto,
  CancelAssetClearanceWaiverDto,
  RejectAssetClearanceWaiverDto,
  RequestAssetClearanceWaiverDto,
  SearchAssetClearanceWaiverDto,
} from './dto/clearance-command.dto';
import { LicenseAllocationService } from './license-allocation.service';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class AssetClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly idempotency: AssetIdempotencyService,
    private readonly auditService: AuditService,
    private readonly mapper: AssetResponseMapper,
    private readonly capabilities: AssetCapabilityService,
    private readonly notifications: AssetNotificationService,
    private readonly custody: AssetCustodyService,
    private readonly licenses: LicenseAllocationService,
  ) {}

  async assertResolved(employeeId: string, tx?: DbClient) {
    const db = tx ?? this.prisma;
    const [openAssignments, openAllocations, openItems] = await Promise.all([
      db.employeeAsset.count({
        where: {
          employeeId,
          status: 'ASSIGNED',
          returnedDate: null,
        },
      }),
      db.softwareLicenseAllocation.count({
        where: { employeeId, status: 'ACTIVE' },
      }),
      db.assetClearanceItem.count({
        where: { employeeId, status: AssetClearanceItemStatus.OPEN },
      }),
    ]);

    if (openAssignments + openAllocations + openItems > 0) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_CLEARANCE_BLOCKED,
        'Outstanding asset custody prevents separation or deactivation',
      );
    }
  }

  async preflight(employeeId: string, context: AssetAccessContext) {
    if (!this.access.canReadClearance(context)) {
      throw new ForbiddenException();
    }
    await this.organizationScope.assertEmployeeInScope(employeeId);

    const [assignments, allocations] = await Promise.all([
      this.prisma.employeeAsset.findMany({
        where: {
          employeeId,
          status: 'ASSIGNED',
          returnedDate: null,
        },
        select: {
          id: true,
          version: true,
          assetId: true,
          asset: {
            select: {
              id: true,
              assetCode: true,
              assetName: true,
              version: true,
            },
          },
        },
      }),
      this.prisma.softwareLicenseAllocation.findMany({
        where: { employeeId, status: 'ACTIVE' },
        select: {
          id: true,
          version: true,
          assetId: true,
          asset: {
            select: {
              id: true,
              assetCode: true,
              assetName: true,
              version: true,
            },
          },
        },
      }),
    ]);

    return {
      employeeId,
      blocked: assignments.length + allocations.length > 0,
      openAssignments: assignments,
      openAllocations: allocations,
    };
  }

  async findClearanceAssets(clearanceId: string, context: AssetAccessContext) {
    if (!this.access.canReadClearance(context)) {
      throw new ForbiddenException();
    }
    await this.assertClearanceInScope(clearanceId);
    await this.syncOpenCustodyItems(clearanceId);
    const scopeWhere = await this.access.buildClearanceItemWhere(
      context,
      'read',
    );
    const items = await this.prisma.assetClearanceItem.findMany({
      where: {
        clearanceId,
        ...scopeWhere,
      },
      include: {
        employeeAsset: {
          include: {
            asset: {
              select: {
                id: true,
                assetCode: true,
                assetName: true,
                version: true,
              },
            },
          },
        },
        licenseAllocation: {
          include: {
            asset: {
              select: {
                id: true,
                assetCode: true,
                assetName: true,
                version: true,
              },
            },
          },
        },
        waivers: { orderBy: { requestedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((item) => this.mapper.toClearanceItemResponse(item));
  }

  async syncOpenCustodyItems(clearanceId: string, tx?: DbClient) {
    const db = tx ?? this.prisma;
    const clearance = await db.employeeClearance.findFirst({
      where: { id: clearanceId },
      include: {
        separation: true,
        items: { where: { clearanceType: 'ASSET' } },
      },
    });
    if (!clearance) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CLEARANCE_ITEM_NOT_FOUND,
        'Clearance not found',
      );
    }
    const summaryItem = clearance.items[0];
    if (!summaryItem) {
      return;
    }

    const employeeId = clearance.separation.employeeId;
    const [assignments, allocations] = await Promise.all([
      db.employeeAsset.findMany({
        where: { employeeId, status: 'ASSIGNED', returnedDate: null },
        select: { id: true, asset: { select: { companyId: true } } },
      }),
      db.softwareLicenseAllocation.findMany({
        where: { employeeId, status: 'ACTIVE' },
        select: { id: true, companyId: true },
      }),
    ]);

    for (const assignment of assignments) {
      const existing = await db.assetClearanceItem.findFirst({
        where: { clearanceId, employeeAssetId: assignment.id },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await db.assetClearanceItem.create({
        data: {
          companyId: assignment.asset.companyId,
          clearanceId,
          clearanceSummaryItemId: summaryItem.id,
          employeeId,
          employeeAssetId: assignment.id,
          status: AssetClearanceItemStatus.OPEN,
        },
      });
    }

    for (const allocation of allocations) {
      const existing = await db.assetClearanceItem.findFirst({
        where: { clearanceId, licenseAllocationId: allocation.id },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await db.assetClearanceItem.create({
        data: {
          companyId: allocation.companyId,
          clearanceId,
          clearanceSummaryItemId: summaryItem.id,
          employeeId,
          licenseAllocationId: allocation.id,
          status: AssetClearanceItemStatus.OPEN,
        },
      });
    }
  }

  async requestWaiver(
    itemId: string,
    dto: RequestAssetClearanceWaiverDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageCustody(context)) {
      throw new ForbiddenException();
    }
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'REQUEST_ASSET_CLEARANCE_WAIVER',
      { itemId, ...dto },
      async (tx) => {
        const scopeWhere = await this.access.buildClearanceItemWhere(
          context,
          'manage',
        );
        const item = await tx.assetClearanceItem.findFirst({
          where: { id: itemId, ...scopeWhere },
          include: {
            employeeAsset: true,
            licenseAllocation: true,
          },
        });
        if (!item || item.status !== AssetClearanceItemStatus.OPEN) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_CLEARANCE_ITEM_NOT_FOUND,
            'Clearance item not found',
          );
        }
        this.assertExpectedVersion(
          item.version,
          dto.expectedClearanceItemVersion,
        );
        const targetVersion =
          item.employeeAsset?.version ?? item.licenseAllocation?.version ?? 0;
        this.assertExpectedVersion(targetVersion, dto.expectedTargetVersion);

        const pending = await tx.assetClearanceWaiver.findFirst({
          where: {
            assetClearanceItemId: itemId,
            status: AssetClearanceWaiverStatus.REQUESTED,
          },
        });
        if (pending) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_WAIVER_ALREADY_REQUESTED,
            'A waiver is already pending for this item',
          );
        }

        const created = await tx.assetClearanceWaiver.create({
          data: {
            assetClearanceItemId: itemId,
            status: AssetClearanceWaiverStatus.REQUESTED,
            reasonCode: dto.reasonCode,
            reason: dto.reason.trim(),
            evidenceReference: dto.evidenceReference?.trim() || null,
            requestedByUserId: context.userId,
            requestedAt: new Date(),
          },
        });

        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.CLEARANCE_WAIVER_REQUESTED,
          'AssetClearanceWaiver',
          created.id,
          {
            companyId: item.companyId,
            employeeId: item.employeeId,
            assetClearanceItemId: itemId,
            assetClearanceWaiverId: created.id,
            status: 'REQUESTED',
            recipientUserIds: [context.userId],
          },
          `asset-clearance-waiver:${created.id}`,
        );

        return this.idempotency.commandMeta(
          'ASSET_CLEARANCE_WAIVER',
          created.id,
        );
      },
      (id) => this.findWaiverDetail(id, context),
    );
  }

  async approveWaiver(
    id: string,
    dto: ApproveAssetClearanceWaiverDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canWaiveClearance(context)) {
      throw new ForbiddenException();
    }
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'APPROVE_ASSET_CLEARANCE_WAIVER',
      { id, ...dto },
      async (tx) => {
        const scopeWhere = await this.access.buildClearanceItemWhere(
          context,
          'read',
        );
        const waiver = await tx.assetClearanceWaiver.findFirst({
          where: {
            id,
            clearanceItem: scopeWhere,
          },
          include: {
            clearanceItem: {
              include: { employeeAsset: true, licenseAllocation: true },
            },
          },
        });
        if (!waiver) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_CLEARANCE_WAIVER_NOT_FOUND,
            'Waiver not found',
          );
        }
        if (waiver.requestedByUserId === context.userId) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_WAIVER_SELF_APPROVAL_FORBIDDEN,
            'The requester cannot approve this waiver',
          );
        }
        this.assertExpectedVersion(waiver.version, dto.expectedWaiverVersion);
        this.assertExpectedVersion(
          waiver.clearanceItem.version,
          dto.expectedClearanceItemVersion,
        );
        if (waiver.status !== AssetClearanceWaiverStatus.REQUESTED) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_WAIVER_INVALID_STATE,
            'Waiver is not pending approval',
          );
        }

        const item = waiver.clearanceItem;
        if (item.employeeAssetId) {
          await this.custody.waiveInTransaction(
            tx,
            item.employeeAssetId,
            context,
            dto.expectedTargetVersion,
            dto.expectedAssetVersion,
          );
        } else if (item.licenseAllocationId) {
          await this.licenses.waiveInTransaction(
            tx,
            item.licenseAllocationId,
            context,
            dto.expectedTargetVersion,
            dto.expectedAssetVersion,
          );
        }

        await tx.assetClearanceWaiver.update({
          where: { id },
          data: {
            status: AssetClearanceWaiverStatus.APPROVED,
            decidedAt: new Date(),
            decidedByUserId: context.userId,
            decisionNote: dto.decisionNote?.trim() || null,
            version: { increment: 1 },
          },
        });
        await tx.assetClearanceItem.update({
          where: { id: item.id },
          data: {
            status: AssetClearanceItemStatus.WAIVED,
            resolvedAt: new Date(),
            resolutionType: 'WAIVED',
            version: { increment: 1 },
          },
        });

        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.CLEARANCE_WAIVER_APPROVED,
          'AssetClearanceWaiver',
          id,
          {
            companyId: item.companyId,
            employeeId: item.employeeId,
            assetClearanceWaiverId: id,
            status: 'APPROVED',
            recipientUserIds: [context.userId],
          },
          `asset-clearance-waiver-approved:${id}`,
        );

        return this.idempotency.commandMeta('ASSET_CLEARANCE_WAIVER', id);
      },
      () => this.findWaiverDetail(id, context),
    );
  }

  async rejectWaiver(
    id: string,
    dto: RejectAssetClearanceWaiverDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canWaiveClearance(context)) {
      throw new ForbiddenException();
    }
    return this.decideWaiver(id, context, 'REJECT', dto);
  }

  async cancelWaiver(
    id: string,
    dto: CancelAssetClearanceWaiverDto,
    context: AssetAccessContext,
  ) {
    return this.decideWaiver(id, context, 'CANCEL', dto);
  }

  async findWaiverPage(
    query: SearchAssetClearanceWaiverDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canWaiveClearance(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }
    const scopeWhere = await this.access.buildClearanceItemWhere(
      context,
      'read',
    );
    const where: Prisma.AssetClearanceWaiverWhereInput = {
      clearanceItem: {
        ...scopeWhere,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.assetClearanceWaiver.findMany({
        where,
        include: {
          requestedByUser: { select: { id: true, displayName: true } },
          decidedByUser: { select: { id: true, displayName: true } },
          clearanceItem: {
            include: {
              employeeAsset: {
                select: {
                  id: true,
                  version: true,
                  assetId: true,
                  asset: { select: { id: true, version: true } },
                },
              },
              licenseAllocation: {
                select: {
                  id: true,
                  version: true,
                  assetId: true,
                  asset: { select: { id: true, version: true } },
                },
              },
            },
          },
        },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetClearanceWaiver.count({ where }),
    ]);
    return this.mapper.toPaginatedInventory(
      rows.map((row) =>
        this.mapper.toClearanceWaiverResponse(
          row,
          this.capabilities.getWaiverAllowedActions(row, context),
        ),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async findWaiverDetail(id: string, context: AssetAccessContext) {
    const scopeWhere = await this.access.buildClearanceItemWhere(
      context,
      'read',
    );
    const waiver = await this.prisma.assetClearanceWaiver.findFirst({
      where: {
        id,
        clearanceItem: scopeWhere,
      },
      include: {
        requestedByUser: { select: { id: true, displayName: true } },
        decidedByUser: { select: { id: true, displayName: true } },
        clearanceItem: {
          include: {
            employeeAsset: {
              select: {
                id: true,
                version: true,
                assetId: true,
                asset: { select: { id: true, version: true } },
              },
            },
            licenseAllocation: {
              select: {
                id: true,
                version: true,
                assetId: true,
                asset: { select: { id: true, version: true } },
              },
            },
          },
        },
      },
    });
    if (!waiver) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CLEARANCE_WAIVER_NOT_FOUND,
        'Waiver not found',
      );
    }
    const isParticipant = waiver.requestedByUserId === context.userId;
    if (!this.access.canWaiveClearance(context) && !isParticipant) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CLEARANCE_WAIVER_NOT_FOUND,
        'Waiver not found',
      );
    }
    return this.mapper.toClearanceWaiverResponse(
      waiver,
      this.capabilities.getWaiverAllowedActions(waiver, context),
    );
  }

  private async decideWaiver(
    id: string,
    context: AssetAccessContext,
    action: 'REJECT' | 'CANCEL',
    dto: RejectAssetClearanceWaiverDto | CancelAssetClearanceWaiverDto,
  ) {
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      `${action}_ASSET_CLEARANCE_WAIVER`,
      { id, ...dto },
      async (tx) => {
        const scopeWhere = await this.access.buildClearanceItemWhere(
          context,
          'read',
        );
        const waiver = await tx.assetClearanceWaiver.findFirst({
          where: {
            id,
            clearanceItem: scopeWhere,
          },
          include: { clearanceItem: true },
        });
        if (!waiver) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_CLEARANCE_WAIVER_NOT_FOUND,
            'Waiver not found',
          );
        }
        this.assertExpectedVersion(waiver.version, dto.expectedWaiverVersion);
        this.assertExpectedVersion(
          waiver.clearanceItem.version,
          dto.expectedClearanceItemVersion,
        );
        if (waiver.status !== AssetClearanceWaiverStatus.REQUESTED) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_WAIVER_INVALID_STATE,
            'Waiver is not pending',
          );
        }
        if (action === 'CANCEL') {
          if (
            waiver.requestedByUserId !== context.userId &&
            !this.access.canManageInventoryBroad(context)
          ) {
            throw new ForbiddenException();
          }
        }
        const now = new Date();
        await tx.assetClearanceWaiver.update({
          where: { id },
          data:
            action === 'REJECT'
              ? {
                  status: AssetClearanceWaiverStatus.REJECTED,
                  decidedAt: now,
                  decidedByUserId: context.userId,
                  decisionNote:
                    'decisionNote' in dto ? dto.decisionNote.trim() : null,
                  version: { increment: 1 },
                }
              : {
                  status: AssetClearanceWaiverStatus.CANCELLED,
                  cancelledAt: now,
                  cancelledByUserId: context.userId,
                  cancelReason: 'reason' in dto ? dto.reason.trim() : null,
                  version: { increment: 1 },
                },
        });
        if (action === 'REJECT') {
          await this.notifications.enqueue(
            tx,
            ASSET_NOTIFICATION_EVENT.CLEARANCE_WAIVER_REJECTED,
            'AssetClearanceWaiver',
            id,
            {
              companyId: waiver.clearanceItem.companyId,
              employeeId: waiver.clearanceItem.employeeId,
              assetClearanceWaiverId: id,
              status: 'REJECTED',
              recipientUserIds: [context.userId],
            },
            `asset-clearance-waiver-rejected:${id}`,
          );
        }
        return this.idempotency.commandMeta('ASSET_CLEARANCE_WAIVER', id);
      },
      () => this.findWaiverDetail(id, context),
    );
  }

  private async assertClearanceInScope(clearanceId: string) {
    const clearance = await this.prisma.employeeClearance.findFirst({
      where: { id: clearanceId },
      include: { separation: { select: { employeeId: true } } },
    });
    if (!clearance) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CLEARANCE_ITEM_NOT_FOUND,
        'Clearance not found',
      );
    }
    await this.organizationScope.assertEmployeeInScope(
      clearance.separation.employeeId,
    );
  }

  private assertExpectedVersion(actual: number, expected?: number) {
    if (expected !== undefined && expected !== actual) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }
  }
}
