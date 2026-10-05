import { ForbiddenException, Injectable } from '@nestjs/common';
import { AssetTransferStatus, Prisma } from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetCapabilityService } from './asset-capability.service';
import { AssetIdempotencyService } from './asset-idempotency.service';
import {
  ASSET_NOTIFICATION_EVENT,
  AssetNotificationService,
} from './asset-notification.service';
import { ASSET_TRANSFER_DETAIL_INCLUDE } from './asset-domain.constants';
import { AssetResponseMapper } from './asset-response.mapper';
import {
  AcceptAssetTransferCommandDto,
  CancelAssetTransferCommandDto,
  ForceAssetTransferCommandDto,
  RejectAssetTransferCommandDto,
  RequestAssetTransferCommandDto,
  SearchAssetTransferDto,
} from './dto/transfer-request-command.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class AssetTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly idempotency: AssetIdempotencyService,
    private readonly auditService: AuditService,
    private readonly mapper: AssetResponseMapper,
    private readonly capabilities: AssetCapabilityService,
    private readonly notifications: AssetNotificationService,
  ) {}

  async request(
    assetId: string,
    dto: RequestAssetTransferCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageInventory(context)) {
      throw new ForbiddenException();
    }

    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'REQUEST_ASSET_TRANSFER',
      { assetId, ...dto },
      async (tx) => {
        const asset = await tx.asset.findFirst({
          where: {
            id: assetId,
            ...(await this.access.buildAssetManageWhere(context)),
          },
        });
        if (!asset) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_NOT_FOUND,
            'Asset not found',
          );
        }
        this.assertExpectedVersion(asset.version, dto.expectedAssetVersion);
        if (!asset.departmentId || !asset.branchId) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_TRANSFER_INVALID_DESTINATION,
            'Asset has no owning department to transfer from',
          );
        }
        if (asset.departmentId === dto.toDepartmentId) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_TRANSFER_INVALID_DESTINATION,
            'Destination department must be different from the current owner',
          );
        }

        const destination =
          await this.organizationScope.assertDepartmentInScope(
            dto.toDepartmentId,
            asset.companyId,
          );
        await this.access.assertTransferPair({
          companyId: asset.companyId,
          fromBranchId: asset.branchId,
          toBranchId: destination.branchId,
        });

        const pending = await tx.assetOwnershipTransfer.findFirst({
          where: { assetId, status: AssetTransferStatus.PENDING },
          select: { id: true },
        });
        if (pending) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_TRANSFER_ALREADY_PENDING,
            'A pending transfer already exists for this asset',
          );
        }

        const created = await tx.assetOwnershipTransfer.create({
          data: {
            companyId: asset.companyId,
            assetId,
            fromBranchId: asset.branchId,
            fromDepartmentId: asset.departmentId,
            toBranchId: destination.branchId,
            toDepartmentId: destination.id,
            status: AssetTransferStatus.PENDING,
            reason: dto.reason.trim(),
            requestedByUserId: context.userId,
            requestedAt: new Date(),
            assetVersionAtRequest: asset.version,
          },
        });

        await this.auditService.log(
          'AssetOwnershipTransfer',
          created.id,
          'REQUEST',
          null,
          { toDepartmentId: destination.id },
          { tx, userId: context.userId },
        );
        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.TRANSFER_REQUESTED,
          'AssetOwnershipTransfer',
          created.id,
          {
            companyId: asset.companyId,
            branchId: destination.branchId,
            departmentId: destination.id,
            assetId,
            assetTransferId: created.id,
            status: 'PENDING',
            recipientUserIds: [context.userId],
          },
          `asset-transfer-requested:${created.id}`,
        );

        return this.idempotency.commandMeta('ASSET_TRANSFER', created.id);
      },
      (id) => this.findDetail(id, context),
    );
  }

  async accept(
    id: string,
    dto: AcceptAssetTransferCommandDto,
    context: AssetAccessContext,
  ) {
    return this.decide(id, context, 'ACCEPT', dto);
  }

  async reject(
    id: string,
    dto: RejectAssetTransferCommandDto,
    context: AssetAccessContext,
  ) {
    return this.decide(id, context, 'REJECT', dto);
  }

  async cancel(
    id: string,
    dto: CancelAssetTransferCommandDto,
    context: AssetAccessContext,
  ) {
    return this.decide(id, context, 'CANCEL', dto);
  }

  async force(
    id: string,
    dto: ForceAssetTransferCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canForceTransfer(context)) {
      throw new ForbiddenException();
    }
    return this.decide(id, context, 'FORCE', dto);
  }

  async findPage(query: SearchAssetTransferDto, context: AssetAccessContext) {
    if (!this.access.canReadInventory(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const where: Prisma.AssetOwnershipTransferWhereInput = {
      ...(await this.access.buildTransferWhere(context)),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.fromDepartmentId
        ? { fromDepartmentId: query.fromDepartmentId }
        : {}),
      ...(query.toDepartmentId ? { toDepartmentId: query.toDepartmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.assetOwnershipTransfer.findMany({
        where,
        include: ASSET_TRANSFER_DETAIL_INCLUDE,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetOwnershipTransfer.count({ where }),
    ]);

    const grantedDepartmentIds =
      await this.access.getActiveGrantedDepartmentIds(context);

    return this.mapper.toPaginatedInventory(
      rows.map((row) =>
        this.mapper.toTransferResponse(
          row,
          this.capabilities.getTransferAllowedActions(
            row,
            context,
            grantedDepartmentIds,
          ),
        ),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async findDetail(id: string, context: AssetAccessContext) {
    const transfer = await this.prisma.assetOwnershipTransfer.findFirst({
      where: {
        id,
        ...(await this.access.buildTransferWhere(context)),
      },
      include: ASSET_TRANSFER_DETAIL_INCLUDE,
    });
    if (!transfer) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_TRANSFER_NOT_FOUND,
        'Transfer not found',
      );
    }
    const grantedDepartmentIds =
      await this.access.getActiveGrantedDepartmentIds(context);
    return this.mapper.toTransferResponse(
      transfer,
      this.capabilities.getTransferAllowedActions(
        transfer,
        context,
        grantedDepartmentIds,
      ),
    );
  }

  private async decide(
    id: string,
    context: AssetAccessContext,
    action: 'ACCEPT' | 'REJECT' | 'CANCEL' | 'FORCE',
    dto:
      | AcceptAssetTransferCommandDto
      | RejectAssetTransferCommandDto
      | CancelAssetTransferCommandDto
      | ForceAssetTransferCommandDto,
  ) {
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      `${action}_ASSET_TRANSFER`,
      { id, ...dto },
      async (tx) => {
        const transfer = await tx.assetOwnershipTransfer.findFirst({
          where: {
            id,
            ...(await this.access.buildTransferWhere(context)),
          },
          include: { asset: true },
        });
        if (!transfer) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_TRANSFER_NOT_FOUND,
            'Transfer not found',
          );
        }
        this.assertExpectedVersion(
          transfer.version,
          dto.expectedTransferVersion,
        );
        this.assertExpectedVersion(
          transfer.asset.version,
          dto.expectedAssetVersion,
        );
        if (transfer.status !== AssetTransferStatus.PENDING) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_TRANSFER_INVALID_STATE,
            'Transfer is not pending',
          );
        }

        await this.organizationScope.assertDepartmentInScope(
          transfer.toDepartmentId,
          transfer.companyId,
        );
        await this.access.assertTransferPair({
          companyId: transfer.companyId,
          fromBranchId: transfer.fromBranchId,
          toBranchId: transfer.toBranchId,
        });

        if (action === 'ACCEPT' || action === 'FORCE') {
          if (action === 'FORCE' && !this.access.canForceTransfer(context)) {
            throw new ForbiddenException();
          }
          await this.applyOwnershipChange(tx, transfer, context, action);
        } else if (action === 'CANCEL') {
          if (
            transfer.requestedByUserId !== context.userId &&
            !this.access.canManageInventoryBroad(context)
          ) {
            throw new ForbiddenException();
          }
        } else {
          await this.access.assertDepartmentManageable(
            transfer.toDepartmentId,
            context,
          );
        }

        const nextStatus =
          action === 'ACCEPT'
            ? AssetTransferStatus.ACCEPTED
            : action === 'FORCE'
              ? AssetTransferStatus.FORCED
              : action === 'REJECT'
                ? AssetTransferStatus.REJECTED
                : AssetTransferStatus.CANCELLED;

        const now = new Date();
        await tx.assetOwnershipTransfer.update({
          where: { id },
          data: {
            status: nextStatus,
            version: { increment: 1 },
            ...(action === 'CANCEL'
              ? {
                  cancelledAt: now,
                  cancelledByUserId: context.userId,
                  cancelReason: 'reason' in dto ? dto.reason.trim() : undefined,
                }
              : {
                  decidedAt: now,
                  decidedByUserId: context.userId,
                  decisionNote:
                    'decisionNote' in dto
                      ? dto.decisionNote?.trim() || null
                      : null,
                  ...(action === 'FORCE'
                    ? {
                        forcedAt: now,
                        forcedByUserId: context.userId,
                        forceReason:
                          'forceReason' in dto
                            ? dto.forceReason.trim()
                            : undefined,
                      }
                    : {}),
                }),
          },
        });

        await tx.asset.updateMany({
          where: { id: transfer.assetId, version: transfer.asset.version },
          data: { version: { increment: 1 } },
        });

        await this.auditService.log(
          'AssetOwnershipTransfer',
          id,
          action,
          transfer,
          { status: nextStatus },
          { tx, userId: context.userId },
        );

        if (action === 'ACCEPT' || action === 'FORCE') {
          await this.notifications.enqueue(
            tx,
            ASSET_NOTIFICATION_EVENT.TRANSFER_ACCEPTED,
            'AssetOwnershipTransfer',
            id,
            {
              companyId: transfer.companyId,
              departmentId: transfer.toDepartmentId,
              assetId: transfer.assetId,
              assetTransferId: id,
              status: nextStatus,
              recipientUserIds: [context.userId],
            },
            `asset-transfer-accepted:${id}`,
          );
        } else if (action === 'REJECT') {
          await this.notifications.enqueue(
            tx,
            ASSET_NOTIFICATION_EVENT.TRANSFER_REJECTED,
            'AssetOwnershipTransfer',
            id,
            {
              companyId: transfer.companyId,
              departmentId: transfer.toDepartmentId,
              assetId: transfer.assetId,
              assetTransferId: id,
              status: nextStatus,
              recipientUserIds: [context.userId],
            },
            `asset-transfer-rejected:${id}`,
          );
        }

        return this.idempotency.commandMeta('ASSET_TRANSFER', id);
      },
      () => this.findDetail(id, context),
    );
  }

  private async applyOwnershipChange(
    tx: DbClient,
    transfer: {
      id: string;
      assetId: string;
      fromBranchId: string;
      toBranchId: string;
      toDepartmentId: string;
      assetVersionAtRequest: number;
      asset: {
        id: string;
        version: number;
        departmentId: string | null;
        branchId: string | null;
        trackingMode: string | null;
      };
    },
    context: AssetAccessContext,
    action: 'ACCEPT' | 'FORCE',
  ) {
    if (action === 'ACCEPT') {
      await this.access.assertDepartmentManageable(
        transfer.toDepartmentId,
        context,
      );
    }

    if (transfer.asset.version !== transfer.assetVersionAtRequest) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_TRANSFER_ASSET_CHANGED,
        'Asset has changed since the transfer was requested',
      );
    }

    if (transfer.fromBranchId !== transfer.toBranchId) {
      const openCustody = await tx.employeeAsset.count({
        where: {
          assetId: transfer.assetId,
          status: 'ASSIGNED',
          returnedDate: null,
        },
      });
      const openRequest = await tx.assetCustodyRequest.count({
        where: {
          employeeAsset: { assetId: transfer.assetId },
          status: { in: ['SUBMITTED', 'IN_REVIEW'] },
        },
      });
      if (openCustody > 0 || openRequest > 0) {
        throw new DomainConflictException(
          ASSET_ERROR_CODES.ASSET_TRANSFER_ACTIVE_CUSTODY,
          'Cross-branch transfer is blocked while custody is open',
        );
      }
    }

    const moved = await tx.asset.updateMany({
      where: { id: transfer.assetId, version: transfer.asset.version },
      data: {
        departmentId: transfer.toDepartmentId,
        branchId: transfer.toBranchId,
      },
    });
    if (moved.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }
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
