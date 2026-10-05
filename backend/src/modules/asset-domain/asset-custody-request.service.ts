import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssetCustodyRequestStatus,
  AssetCustodyRequestType,
  AssetCustodyTargetType,
  Prisma,
} from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetCustodyService } from './asset-custody.service';
import { ASSET_CUSTODY_REQUEST_DETAIL_INCLUDE } from './asset-domain.constants';
import { AssetCustodyCloseOutcome } from './dto/close-employee-asset-command.dto';
import { AssetIdempotencyService } from './asset-idempotency.service';
import {
  ASSET_NOTIFICATION_EVENT,
  AssetNotificationService,
} from './asset-notification.service';
import { AssetResponseMapper } from './asset-response.mapper';
import {
  CancelMyCustodyRequestDto,
  CompleteCustodyRequestDto,
  CreateMyAssetRequestDto,
  RejectCustodyRequestDto,
  SearchAssetCustodyRequestDto,
  StartCustodyRequestReviewDto,
} from './dto/transfer-request-command.dto';
import { LicenseAllocationService } from './license-allocation.service';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

@Injectable()
export class AssetCustodyRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly idempotency: AssetIdempotencyService,
    private readonly auditService: AuditService,
    private readonly mapper: AssetResponseMapper,
    private readonly notifications: AssetNotificationService,
    private readonly custody: AssetCustodyService,
    private readonly licenses: LicenseAllocationService,
  ) {}

  async createMine(dto: CreateMyAssetRequestDto, context: AssetAccessContext) {
    if (!context.employeeId) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH,
        'Only the assigned employee can submit this request',
      );
    }

    this.assertRequestTypeMatchesTarget(dto);
    if (dto.requestType === AssetCustodyRequestType.REVOKE_LICENSE) {
      await this.access.assertLicensePoolScope(context);
    }
    const companyId = context.activeCompanyId ?? 'unknown';

    return this.idempotency.execute(
      context,
      companyId,
      'CREATE_ASSET_CUSTODY_REQUEST',
      dto,
      async (tx) => {
        const target = await this.loadEmployeeTarget(
          tx,
          dto,
          context.employeeId!,
        );
        this.assertExpectedVersion(target.version, dto.expectedTargetVersion);

        if (target.closed) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_REQUEST_TARGET_CLOSED,
            'Custody has already been closed',
          );
        }

        const open = await tx.assetCustodyRequest.findFirst({
          where: {
            employeeId: context.employeeId,
            status: { in: ['SUBMITTED', 'IN_REVIEW'] },
            ...(dto.targetType === AssetCustodyTargetType.EMPLOYEE_ASSET
              ? { employeeAssetId: dto.targetId }
              : { licenseAllocationId: dto.targetId }),
          },
          select: { id: true },
        });
        if (open) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_REQUEST_ALREADY_OPEN,
            'An open request already exists for this item',
          );
        }

        if (dto.occurredOn && new Date(dto.occurredOn).getTime() > Date.now()) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_DATE_RANGE_INVALID,
            'occurredOn cannot be in the future',
          );
        }

        const created = await tx.assetCustodyRequest.create({
          data: {
            companyId: target.companyId,
            branchId: target.branchId,
            departmentId: target.departmentId,
            employeeId: context.employeeId!,
            targetType: dto.targetType,
            employeeAssetId:
              dto.targetType === AssetCustodyTargetType.EMPLOYEE_ASSET
                ? dto.targetId
                : null,
            licenseAllocationId:
              dto.targetType === AssetCustodyTargetType.LICENSE_ALLOCATION
                ? dto.targetId
                : null,
            requestType: dto.requestType,
            status: AssetCustodyRequestStatus.SUBMITTED,
            occurredOn: dto.occurredOn ? new Date(dto.occurredOn) : null,
            employeeNote: dto.employeeNote?.trim() || null,
            requestedAt: new Date(),
          },
        });

        await this.auditService.log(
          'AssetCustodyRequest',
          created.id,
          'SUBMIT',
          null,
          { requestType: dto.requestType },
          { tx, userId: context.userId },
        );
        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.CUSTODY_REQUEST_SUBMITTED,
          'AssetCustodyRequest',
          created.id,
          {
            companyId: target.companyId,
            branchId: target.branchId,
            departmentId: target.departmentId,
            employeeId: context.employeeId,
            assetId: target.assetId,
            assetCustodyRequestId: created.id,
            employeeAssetId: created.employeeAssetId ?? undefined,
            licenseAllocationId: created.licenseAllocationId ?? undefined,
            status: 'SUBMITTED',
          },
          `asset-custody-request:${created.id}`,
        );

        return this.idempotency.commandMeta(
          'ASSET_CUSTODY_REQUEST',
          created.id,
        );
      },
      (id) => this.findMineDetail(id, context),
    );
  }

  async cancelMine(
    id: string,
    dto: CancelMyCustodyRequestDto,
    context: AssetAccessContext,
  ) {
    if (!context.employeeId) {
      throw new ForbiddenException();
    }
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'CANCEL_ASSET_CUSTODY_REQUEST',
      { id, ...dto },
      async (tx) => {
        const request = await tx.assetCustodyRequest.findFirst({
          where: { id, employeeId: context.employeeId },
        });
        if (!request) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_REQUEST_NOT_FOUND,
            'Request not found',
          );
        }
        this.assertExpectedVersion(request.version, dto.expectedRequestVersion);
        if (request.status !== AssetCustodyRequestStatus.SUBMITTED) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_REQUEST_INVALID_STATE,
            'Only submitted requests can be cancelled',
          );
        }
        await tx.assetCustodyRequest.update({
          where: { id },
          data: {
            status: AssetCustodyRequestStatus.CANCELLED,
            resolvedAt: new Date(),
            resolvedByUserId: context.userId,
            resolutionNote: dto.reason?.trim() || null,
            version: { increment: 1 },
          },
        });
        return this.idempotency.commandMeta('ASSET_CUSTODY_REQUEST', id);
      },
      () => this.findMineDetail(id, context),
    );
  }

  async startReview(
    id: string,
    dto: StartCustodyRequestReviewDto,
    context: AssetAccessContext,
  ) {
    this.assertManage(context);
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'START_ASSET_CUSTODY_REQUEST_REVIEW',
      { id, ...dto },
      async (tx) => {
        const request = await this.loadManagedRequest(tx, id, context);
        this.assertExpectedVersion(request.version, dto.expectedRequestVersion);
        if (request.status !== AssetCustodyRequestStatus.SUBMITTED) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_REQUEST_INVALID_STATE,
            'Request is not waiting for review',
          );
        }
        await tx.assetCustodyRequest.update({
          where: { id },
          data: {
            status: AssetCustodyRequestStatus.IN_REVIEW,
            reviewedAt: new Date(),
            reviewedByUserId: context.userId,
            version: { increment: 1 },
          },
        });
        return this.idempotency.commandMeta('ASSET_CUSTODY_REQUEST', id);
      },
      () => this.findDetail(id, context),
    );
  }

  async complete(
    id: string,
    dto: CompleteCustodyRequestDto,
    context: AssetAccessContext,
  ) {
    this.assertManage(context);
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'COMPLETE_ASSET_CUSTODY_REQUEST',
      { id, ...dto },
      async (tx) => {
        const request = await this.loadManagedRequest(tx, id, context);
        this.assertExpectedVersion(request.version, dto.expectedRequestVersion);
        if (
          request.status !== AssetCustodyRequestStatus.SUBMITTED &&
          request.status !== AssetCustodyRequestStatus.IN_REVIEW
        ) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_REQUEST_INVALID_STATE,
            'Request cannot be completed',
          );
        }

        if (request.targetType === AssetCustodyTargetType.EMPLOYEE_ASSET) {
          const outcome = this.outcomeFor(request.requestType);
          await this.custody.closeInTransaction(
            tx,
            request.employeeAssetId!,
            {
              outcome,
              effectiveDate: dto.effectiveDate,
              expectedAssignmentVersion: dto.expectedTargetVersion,
              expectedAssetVersion: dto.expectedAssetVersion,
              conditionOnReturn: dto.conditionOnReturn,
              reason: dto.resolutionNote ?? request.requestType,
            },
            context,
          );
        } else {
          await this.licenses.revokeInTransaction(
            tx,
            request.licenseAllocationId!,
            {
              expectedAllocationVersion: dto.expectedTargetVersion,
              expectedPoolVersion: dto.expectedAssetVersion,
              revokedDate: dto.effectiveDate,
              reason: dto.resolutionNote ?? 'Employee licence revoke request',
            },
            context,
          );
        }

        await tx.assetCustodyRequest.update({
          where: { id },
          data: {
            status: AssetCustodyRequestStatus.COMPLETED,
            resolvedAt: new Date(),
            resolvedByUserId: context.userId,
            resolutionNote: dto.resolutionNote?.trim() || null,
            version: { increment: 1 },
          },
        });

        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.CUSTODY_REQUEST_RESOLVED,
          'AssetCustodyRequest',
          id,
          {
            companyId: request.companyId,
            employeeId: request.employeeId,
            assetCustodyRequestId: id,
            status: 'COMPLETED',
          },
          `asset-custody-request-resolved:${id}`,
        );

        return this.idempotency.commandMeta('ASSET_CUSTODY_REQUEST', id);
      },
      () => this.findDetail(id, context),
    );
  }

  async reject(
    id: string,
    dto: RejectCustodyRequestDto,
    context: AssetAccessContext,
  ) {
    this.assertManage(context);
    const companyId = context.activeCompanyId ?? 'unknown';
    return this.idempotency.execute(
      context,
      companyId,
      'REJECT_ASSET_CUSTODY_REQUEST',
      { id, ...dto },
      async (tx) => {
        const request = await this.loadManagedRequest(tx, id, context);
        this.assertExpectedVersion(request.version, dto.expectedRequestVersion);
        if (
          request.status !== AssetCustodyRequestStatus.SUBMITTED &&
          request.status !== AssetCustodyRequestStatus.IN_REVIEW
        ) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_REQUEST_INVALID_STATE,
            'Request cannot be rejected',
          );
        }
        await tx.assetCustodyRequest.update({
          where: { id },
          data: {
            status: AssetCustodyRequestStatus.REJECTED,
            resolvedAt: new Date(),
            resolvedByUserId: context.userId,
            resolutionNote: dto.resolutionNote.trim(),
            version: { increment: 1 },
          },
        });
        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.CUSTODY_REQUEST_RESOLVED,
          'AssetCustodyRequest',
          id,
          {
            companyId: request.companyId,
            employeeId: request.employeeId,
            assetCustodyRequestId: id,
            status: 'REJECTED',
          },
          `asset-custody-request-resolved:${id}`,
        );
        return this.idempotency.commandMeta('ASSET_CUSTODY_REQUEST', id);
      },
      () => this.findDetail(id, context),
    );
  }

  async findPage(
    query: SearchAssetCustodyRequestDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canReadCustody(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }
    const where: Prisma.AssetCustodyRequestWhereInput = {
      ...(await this.scopedRequestWhere(context)),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.requestType ? { requestType: query.requestType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.assetCustodyRequest.findMany({
        where,
        include: ASSET_CUSTODY_REQUEST_DETAIL_INCLUDE,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetCustodyRequest.count({ where }),
    ]);
    return this.mapper.toPaginatedInventory(
      rows.map((row) => this.mapper.toCustodyRequestResponse(row)),
      total,
      query.page,
      query.limit,
    );
  }

  async findDetail(id: string, context: AssetAccessContext) {
    const request = await this.prisma.assetCustodyRequest.findFirst({
      where: { id, ...(await this.scopedRequestWhere(context)) },
      include: ASSET_CUSTODY_REQUEST_DETAIL_INCLUDE,
    });
    if (!request) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_REQUEST_NOT_FOUND,
        'Request not found',
      );
    }
    return this.mapper.toCustodyRequestResponse(request);
  }

  async findMine(context: AssetAccessContext) {
    if (!context.employeeId) {
      return this.mapper.toPaginatedInventory([], 0, 1, 10);
    }

    const where: Prisma.AssetCustodyRequestWhereInput = {
      employeeId: context.employeeId,
    };
    const [rows, total] = await Promise.all([
      this.prisma.assetCustodyRequest.findMany({
        where,
        include: ASSET_CUSTODY_REQUEST_DETAIL_INCLUDE,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.prisma.assetCustodyRequest.count({ where }),
    ]);
    return this.mapper.toPaginatedInventory(
      rows.map((row) => this.mapper.toCustodyRequestResponse(row)),
      total,
      1,
      50,
    );
  }

  private async findMineDetail(id: string, context: AssetAccessContext) {
    const request = await this.prisma.assetCustodyRequest.findFirst({
      where: { id, employeeId: context.employeeId },
      include: ASSET_CUSTODY_REQUEST_DETAIL_INCLUDE,
    });
    if (!request) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_REQUEST_NOT_FOUND,
        'Request not found',
      );
    }
    return this.mapper.toCustodyRequestResponse(request);
  }

  private async loadManagedRequest(
    tx: Prisma.TransactionClient,
    id: string,
    context: AssetAccessContext,
  ) {
    const request = await tx.assetCustodyRequest.findFirst({
      where: {
        id,
        ...(await this.scopedRequestWhere(context, 'manage')),
      },
    });
    if (!request) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_REQUEST_NOT_FOUND,
        'Request not found',
      );
    }
    return request;
  }

  private async scopedRequestWhere(
    context: AssetAccessContext,
    mode: 'read' | 'manage' = 'read',
  ): Promise<Prisma.AssetCustodyRequestWhereInput> {
    const assetWhere = await this.access.buildCustodyAssetWhere(context, mode);
    return {
      OR: [
        { employeeAsset: { asset: assetWhere } },
        { licenseAllocation: { asset: assetWhere } },
      ],
    };
  }

  private async loadEmployeeTarget(
    tx: Prisma.TransactionClient,
    dto: CreateMyAssetRequestDto,
    employeeId: string,
  ) {
    if (dto.targetType === AssetCustodyTargetType.EMPLOYEE_ASSET) {
      const assignment = await tx.employeeAsset.findFirst({
        where: { id: dto.targetId, employeeId },
        include: { asset: true },
      });
      if (!assignment) {
        throw new DomainNotFoundException(
          ASSET_ERROR_CODES.ASSET_ASSIGNMENT_NOT_FOUND,
          'Assignment not found',
        );
      }
      return {
        version: assignment.version,
        closed: Boolean(assignment.returnedDate || assignment.closedAt),
        companyId: assignment.asset.companyId,
        branchId:
          assignment.asset.branchId ?? assignment.branchIdAtAssignment ?? '',
        departmentId:
          assignment.asset.departmentId ??
          assignment.departmentIdAtAssignment ??
          '',
        assetId: assignment.assetId,
      };
    }

    const allocation = await tx.softwareLicenseAllocation.findFirst({
      where: { id: dto.targetId, employeeId },
      include: { asset: true },
    });
    if (!allocation) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_NOT_FOUND,
        'Licence allocation not found',
      );
    }
    return {
      version: allocation.version,
      closed: allocation.status !== 'ACTIVE',
      companyId: allocation.asset.companyId,
      branchId: allocation.asset.branchId ?? '',
      departmentId: allocation.asset.departmentId ?? '',
      assetId: allocation.assetId,
    };
  }

  private assertRequestTypeMatchesTarget(dto: CreateMyAssetRequestDto) {
    const physical = new Set<AssetCustodyRequestType>([
      AssetCustodyRequestType.RETURN,
      AssetCustodyRequestType.REPORT_DAMAGED,
      AssetCustodyRequestType.REPORT_LOST,
    ]);
    if (
      dto.targetType === AssetCustodyTargetType.EMPLOYEE_ASSET &&
      !physical.has(dto.requestType)
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.VALIDATION_ERROR,
        'Physical custody only permits return, damaged, or lost requests',
      );
    }
    if (
      dto.targetType === AssetCustodyTargetType.LICENSE_ALLOCATION &&
      dto.requestType !== AssetCustodyRequestType.REVOKE_LICENSE
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.VALIDATION_ERROR,
        'Licence allocations only permit revoke requests',
      );
    }
  }

  private outcomeFor(requestType: AssetCustodyRequestType) {
    switch (requestType) {
      case AssetCustodyRequestType.REPORT_DAMAGED:
        return AssetCustodyCloseOutcome.DAMAGED;
      case AssetCustodyRequestType.REPORT_LOST:
        return AssetCustodyCloseOutcome.LOST;
      default:
        return AssetCustodyCloseOutcome.RETURNED;
    }
  }

  private assertManage(context: AssetAccessContext) {
    if (!this.access.canManageCustody(context)) {
      throw new ForbiddenException();
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
