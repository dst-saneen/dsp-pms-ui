import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssetLifecycleStatus,
  EmployeeAssetStatus,
  Prisma,
} from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetAuditMapper } from './asset-audit.mapper';
import { AssetCapabilityService } from './asset-capability.service';
import { ASSET_CUSTODY_DETAIL_INCLUDE } from './asset-domain.constants';
import { AssetIdempotencyService } from './asset-idempotency.service';
import {
  ASSET_NOTIFICATION_EVENT,
  AssetNotificationService,
} from './asset-notification.service';
import { AssetResponseMapper } from './asset-response.mapper';
import {
  AcknowledgeCustodyCommandDto,
  AssignEmployeeAssetCommandDto,
} from './dto/assign-employee-asset-command.dto';
import {
  AssetCustodyCloseOutcome,
  CloseEmployeeAssetCommandDto,
} from './dto/close-employee-asset-command.dto';
import { SearchEmployeeAssetDto } from './dto/license-allocation-command.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import {
  hashAssetSourceCommand,
  type InternalAssetFulfillmentInput,
} from './policies/asset-source-command';
import {
  assertEffectiveDateWindow,
  assertEmployeeEligibleForAsset,
  assertIndividualAssetAssignable,
  isNonTerminalSeparationStatus,
} from './policies/asset-employee-eligibility';
import { legacyStatusForLifecycle } from './policies/asset-kind-tracking';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class AssetCustodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly idempotency: AssetIdempotencyService,
    private readonly auditService: AuditService,
    private readonly auditMapper: AssetAuditMapper,
    private readonly mapper: AssetResponseMapper,
    private readonly capabilities: AssetCapabilityService,
    private readonly notifications: AssetNotificationService,
  ) {}

  async assign(
    dto: AssignEmployeeAssetCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageCustody(context)) {
      throw new ForbiddenException();
    }

    const companyId = context.activeCompanyId ?? 'unknown';

    return this.idempotency.execute(
      context,
      companyId,
      'ASSIGN_EMPLOYEE_ASSET',
      dto,
      async (tx) => {
        const employee = await this.loadEligibleEmployee(tx, dto.employeeId);
        const asset = await tx.asset.findFirst({
          where: {
            id: dto.assetId,
            ...(await this.access.buildCustodyAssetWhere(context, 'manage')),
          },
        });

        if (!asset) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_NOT_FOUND,
            'Asset not found',
          );
        }

        if (employee.companyId !== asset.companyId) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_NOT_FOUND,
            'Asset not found',
          );
        }

        if (asset.branchId && employee.branchId !== asset.branchId) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_EMPLOYEE_BRANCH_MISMATCH,
            'Employee branch does not match the asset branch',
          );
        }

        assertIndividualAssetAssignable(asset);
        this.assertExpectedVersion(asset.version, dto.expectedAssetVersion);

        const claimed = await tx.asset.updateMany({
          where: {
            id: asset.id,
            version: asset.version,
            lifecycleStatus: AssetLifecycleStatus.ACTIVE,
            isActive: true,
            archivedAt: null,
            status: 'AVAILABLE',
          },
          data: {
            status: 'ASSIGNED',
            version: { increment: 1 },
          },
        });

        if (claimed.count !== 1) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_ALREADY_ASSIGNED,
            'Asset is already assigned to an employee',
          );
        }

        const branchIdAtAssignment = employee.branchId ?? asset.branchId;
        const departmentIdAtAssignment =
          employee.departmentId ?? asset.departmentId;

        if (!branchIdAtAssignment || !departmentIdAtAssignment) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET,
            'Employee branch and department are required to assign an asset',
          );
        }

        const created = await this.createAssignment(tx, {
          companyId: asset.companyId,
          employeeId: employee.id,
          assetId: asset.id,
          assignedDate: new Date(dto.assignedDate),
          assignedByUserId: context.userId,
          branchIdAtAssignment,
          departmentIdAtAssignment,
          remarks: dto.remarks?.trim() || null,
        });

        await this.auditService.log(
          'EmployeeAsset',
          created.id,
          'ASSIGN',
          null,
          this.auditMapper.toSafeSnapshot(created),
          { tx, userId: context.userId },
        );

        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.ASSIGNED,
          'EmployeeAsset',
          created.id,
          {
            companyId: asset.companyId,
            branchId: asset.branchId,
            departmentId: asset.departmentId ?? undefined,
            employeeId: employee.id,
            assetId: asset.id,
            employeeAssetId: created.id,
            status: 'ASSIGNED',
          },
          `asset-assigned:${created.id}`,
        );

        return this.idempotency.commandMeta('EMPLOYEE_ASSET', created.id);
      },
      (id) => this.findDetail(id, context),
    );
  }

  async assignWithinTransaction(
    tx: DbClient,
    input: InternalAssetFulfillmentInput,
  ) {
    const employee = await this.loadEligibleEmployee(tx, input.employeeId);
    const asset = await tx.asset.findFirst({
      where: { id: input.assetId, companyId: employee.companyId },
    });
    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }
    if (asset.branchId && employee.branchId !== asset.branchId) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_EMPLOYEE_BRANCH_MISMATCH,
        'Employee branch does not match the asset branch',
      );
    }
    assertIndividualAssetAssignable(asset);
    this.assertExpectedVersion(asset.version, input.expectedAssetVersion);

    const sourceCommandHash = hashAssetSourceCommand({
      companyId: asset.companyId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceCommandKey: input.sourceCommandKey,
      employeeId: employee.id,
      assetId: asset.id,
      effectiveDate: input.effectiveDate,
      commandKind: 'ASSIGN',
    });

    const existing = await tx.employeeAsset.findFirst({
      where: {
        companyId: asset.companyId,
        sourceCommandKey: input.sourceCommandKey,
      },
    });
    if (existing) {
      if (existing.sourceCommandHash !== sourceCommandHash) {
        throw new DomainConflictException(
          ASSET_ERROR_CODES.ASSET_SOURCE_COMMAND_CONFLICT,
          'Source command key was reused with a different request',
        );
      }
      return existing;
    }

    const branchIdAtAssignment = employee.branchId ?? asset.branchId;
    const departmentIdAtAssignment =
      employee.departmentId ?? asset.departmentId;
    if (!branchIdAtAssignment || !departmentIdAtAssignment) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET,
        'Employee branch and department are required to assign an asset',
      );
    }

    const inserted = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        INSERT INTO "employee_assets" (
          "id", "companyId", "employeeId", "assetId", "assignedDate",
          "assignedByUserId", "branchIdAtAssignment", "departmentIdAtAssignment",
          "status", "custodyStatus", "sourceType", "sourceId",
          "sourceCommandKey", "sourceCommandHash", "version",
          "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), ${asset.companyId}, ${employee.id}, ${asset.id},
          ${new Date(input.effectiveDate)}, ${input.actorUserId},
          ${branchIdAtAssignment}, ${departmentIdAtAssignment},
          'ASSIGNED', 'ASSIGNED', ${Prisma.raw(`'${input.sourceType}'::"AssetSourceType"`)},
          ${input.sourceId}, ${input.sourceCommandKey}, ${sourceCommandHash},
          1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("companyId", "sourceCommandKey")
        WHERE "sourceCommandKey" IS NOT NULL
        DO NOTHING
        RETURNING "id"
      `,
    );

    if (inserted.length !== 1) {
      const raced = await tx.employeeAsset.findFirst({
        where: {
          companyId: asset.companyId,
          sourceCommandKey: input.sourceCommandKey,
        },
      });
      if (!raced || raced.sourceCommandHash !== sourceCommandHash) {
        throw new DomainConflictException(
          ASSET_ERROR_CODES.ASSET_SOURCE_COMMAND_CONFLICT,
          'Source command key was reused with a different request',
        );
      }
      return raced;
    }

    const claimed = await tx.asset.updateMany({
      where: {
        id: asset.id,
        version: asset.version,
        lifecycleStatus: AssetLifecycleStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
        status: 'AVAILABLE',
      },
      data: {
        status: 'ASSIGNED',
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ALREADY_ASSIGNED,
        'Asset is already assigned to an employee',
      );
    }

    return tx.employeeAsset.findFirstOrThrow({
      where: { id: inserted[0].id },
    });
  }

  async close(
    id: string,
    dto: CloseEmployeeAssetCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageCustody(context)) {
      throw new ForbiddenException();
    }

    const companyId = context.activeCompanyId ?? 'unknown';
    const effectiveDate = new Date(dto.effectiveDate ?? dto.returnedDate ?? '');

    if (Number.isNaN(effectiveDate.getTime())) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_DATE_RANGE_INVALID,
        'Effective date is required',
      );
    }

    if (
      (dto.outcome === AssetCustodyCloseOutcome.DAMAGED ||
        dto.outcome === AssetCustodyCloseOutcome.LOST) &&
      !dto.reason?.trim()
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.VALIDATION_ERROR,
        'Reason is required for damaged or lost closures',
      );
    }

    return this.idempotency.execute(
      context,
      companyId,
      'CLOSE_EMPLOYEE_ASSET',
      { id, ...dto },
      async (tx) => {
        await this.closeInTransaction(tx, id, dto, context, effectiveDate);
        return this.idempotency.commandMeta('EMPLOYEE_ASSET', id);
      },
      () => this.findDetail(id, context),
    );
  }

  async closeInTransaction(
    tx: DbClient,
    id: string,
    dto: CloseEmployeeAssetCommandDto,
    context: AssetAccessContext,
    effectiveDate = new Date(dto.effectiveDate ?? dto.returnedDate ?? ''),
  ) {
    const assignment = await this.loadManagedAssignment(tx, id, context);
    this.assertExpectedVersion(
      assignment.version,
      dto.expectedAssignmentVersion,
    );
    this.assertExpectedVersion(
      assignment.asset.version,
      dto.expectedAssetVersion,
    );

    if (
      assignment.status !== 'ASSIGNED' ||
      assignment.returnedDate ||
      assignment.closedAt
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_ALREADY_CLOSED,
        'Asset assignment has already been closed',
      );
    }

    assertEffectiveDateWindow({
      startDate: assignment.assignedDate,
      effectiveDate,
    });

    const nextLifecycle = this.lifecycleForOutcome(dto.outcome);
    const closed = await tx.employeeAsset.updateMany({
      where: {
        id,
        status: 'ASSIGNED',
        returnedDate: null,
        version: assignment.version,
      },
      data: {
        returnedDate: effectiveDate,
        closedAt: effectiveDate,
        closedByUserId: context.userId,
        status: dto.outcome,
        custodyStatus: dto.outcome,
        conditionOnReturn:
          dto.conditionOnReturn?.trim() || dto.remarks?.trim() || null,
        version: { increment: 1 },
      },
    });

    if (closed.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_ALREADY_CLOSED,
        'Asset assignment has already been closed',
      );
    }

    const released = await tx.asset.updateMany({
      where: {
        id: assignment.assetId,
        version: assignment.asset.version,
      },
      data: {
        lifecycleStatus: nextLifecycle,
        status: legacyStatusForLifecycle({
          lifecycleStatus: nextLifecycle,
          archived: false,
          hasOpenCustody: false,
        }),
        version: { increment: 1 },
      },
    });

    if (released.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }

    await this.reconcileLinkedRecords(tx, {
      employeeAssetId: id,
      licenseAllocationId: null,
      resolutionType: dto.outcome,
      userId: context.userId,
      at: effectiveDate,
    });

    await this.auditService.log(
      'EmployeeAsset',
      id,
      'CLOSE',
      assignment,
      { outcome: dto.outcome },
      { tx, userId: context.userId },
    );

    return assignment;
  }

  async waiveInTransaction(
    tx: DbClient,
    id: string,
    context: AssetAccessContext,
    expectedAssignmentVersion: number,
    expectedAssetVersion: number,
  ) {
    const assignment = await tx.employeeAsset.findFirst({
      where: { id },
      include: { asset: true },
    });
    if (!assignment) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_NOT_FOUND,
        'Assignment not found',
      );
    }
    this.assertExpectedVersion(assignment.version, expectedAssignmentVersion);
    this.assertExpectedVersion(assignment.asset.version, expectedAssetVersion);

    const now = new Date();
    const closed = await tx.employeeAsset.updateMany({
      where: {
        id,
        status: 'ASSIGNED',
        returnedDate: null,
        version: assignment.version,
      },
      data: {
        returnedDate: now,
        closedAt: now,
        closedByUserId: context.userId,
        status: 'WAIVED',
        custodyStatus: EmployeeAssetStatus.WAIVED,
        version: { increment: 1 },
      },
    });
    if (closed.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_ALREADY_CLOSED,
        'Asset assignment has already been closed',
      );
    }

    const released = await tx.asset.updateMany({
      where: { id: assignment.assetId, version: assignment.asset.version },
      data: {
        lifecycleStatus: AssetLifecycleStatus.LOST,
        status: 'LOST',
        version: { increment: 1 },
      },
    });
    if (released.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }

    await this.auditService.log(
      'EmployeeAsset',
      id,
      'WAIVE',
      assignment,
      { outcome: 'WAIVED' },
      { tx, userId: context.userId },
    );
  }

  async acknowledge(
    id: string,
    dto: AcknowledgeCustodyCommandDto,
    context: AssetAccessContext,
  ) {
    if (!context.employeeId) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH,
        'Only the assigned employee can acknowledge this asset',
      );
    }

    const companyId = context.activeCompanyId ?? 'unknown';

    return this.idempotency.execute(
      context,
      companyId,
      'ACKNOWLEDGE_EMPLOYEE_ASSET',
      { id, ...dto },
      async (tx) => {
        const assignment = await tx.employeeAsset.findFirst({
          where: { id },
        });

        if (!assignment) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_ASSIGNMENT_NOT_FOUND,
            'Assignment not found',
          );
        }

        if (assignment.employeeId !== context.employeeId) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH,
            'Only the assigned employee can acknowledge this asset',
          );
        }

        this.assertExpectedVersion(assignment.version, dto.expectedVersion);

        if (assignment.acknowledgedAt) {
          return this.idempotency.commandMeta('EMPLOYEE_ASSET', id);
        }

        await tx.employeeAsset.update({
          where: { id },
          data: {
            acknowledgedAt: new Date(),
            acknowledgedByUserId: context.userId,
          },
        });

        return this.idempotency.commandMeta('EMPLOYEE_ASSET', id);
      },
      () => this.findSelfDetail(id, context.employeeId!),
    );
  }

  async findPage(query: SearchEmployeeAssetDto, context: AssetAccessContext) {
    if (!this.access.canReadCustody(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const assetWhere: Prisma.AssetWhereInput = {
      ...(await this.access.buildCustodyAssetWhere(context, 'read')),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };
    const where: Prisma.EmployeeAssetWhereInput = {
      asset: assetWhere,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.custodyStatus
        ? {
            OR: [
              { custodyStatus: query.custodyStatus as never },
              { status: query.custodyStatus },
            ],
          }
        : {}),
    };

    if (!query.includeInactive) {
      where.returnedDate = null;
      where.status = 'ASSIGNED';
    }

    const [rows, total] = await Promise.all([
      this.prisma.employeeAsset.findMany({
        where,
        include: ASSET_CUSTODY_DETAIL_INCLUDE,
        orderBy: [{ assignedDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.employeeAsset.count({ where }),
    ]);

    return this.mapper.toPaginatedInventory(
      rows.map((row) => this.toResponse(row, context)),
      total,
      query.page,
      query.limit,
    );
  }

  async findDetail(id: string, context: AssetAccessContext) {
    const assignment = await this.prisma.employeeAsset.findFirst({
      where: {
        id,
        asset: await this.access.buildCustodyAssetWhere(context, 'read'),
      },
      include: ASSET_CUSTODY_DETAIL_INCLUDE,
    });

    if (!assignment) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_NOT_FOUND,
        'Assignment not found',
      );
    }

    return this.toResponse(assignment, context);
  }

  async findByEmployee(employeeId: string, context: AssetAccessContext) {
    await this.organizationScope.assertEmployeeInScope(employeeId);
    if (!this.access.canReadCustody(context)) {
      return [];
    }

    const rows = await this.prisma.employeeAsset.findMany({
      where: {
        employeeId,
        asset: await this.access.buildCustodyAssetWhere(context, 'read'),
      },
      include: ASSET_CUSTODY_DETAIL_INCLUDE,
      orderBy: [{ assignedDate: 'desc' }, { id: 'desc' }],
      take: 100,
    });

    return rows.map((row) => this.toResponse(row, context));
  }

  async findByAsset(assetId: string, context: AssetAccessContext) {
    if (!this.access.canReadCustody(context)) {
      return [];
    }

    const rows = await this.prisma.employeeAsset.findMany({
      where: {
        assetId,
        asset: await this.access.buildCustodyAssetWhere(context, 'read'),
      },
      include: ASSET_CUSTODY_DETAIL_INCLUDE,
      orderBy: [{ assignedDate: 'desc' }, { id: 'desc' }],
      take: 100,
    });

    return rows.map((row) => this.toResponse(row, context));
  }

  private async findSelfDetail(id: string, employeeId: string) {
    const assignment = await this.prisma.employeeAsset.findFirst({
      where: { id, employeeId },
      include: ASSET_CUSTODY_DETAIL_INCLUDE,
    });

    if (!assignment) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_NOT_FOUND,
        'Assignment not found',
      );
    }

    return this.mapper.toEmployeeAssetResponse(
      assignment,
      this.capabilities.getEmployeeAssetAllowedActions(assignment, {
        isSelfService: true,
      }),
    );
  }

  private toResponse(
    assignment: Prisma.EmployeeAssetGetPayload<{
      include: typeof ASSET_CUSTODY_DETAIL_INCLUDE;
    }>,
    context: AssetAccessContext,
  ) {
    return this.mapper.toEmployeeAssetResponse(
      assignment,
      this.capabilities.getEmployeeAssetAllowedActions(assignment, {
        isSelfService: false,
        canManageCustody: this.access.canManageCustody(context),
      }),
    );
  }

  private async loadManagedAssignment(
    tx: DbClient,
    id: string,
    context: AssetAccessContext,
  ) {
    const assignment = await tx.employeeAsset.findFirst({
      where: {
        id,
        asset: await this.access.buildCustodyAssetWhere(context, 'manage'),
      },
      include: { asset: true },
    });

    if (!assignment) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_ASSIGNMENT_NOT_FOUND,
        'Assignment not found',
      );
    }

    return assignment;
  }

  private async loadEligibleEmployee(tx: DbClient, employeeId: string) {
    const employee =
      await this.organizationScope.assertEmployeeInScope(employeeId);

    const separation = await tx.employeeSeparation.findFirst({
      where: {
        employeeId,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      include: { clearance: true },
    });

    assertEmployeeEligibleForAsset({
      isActive: employee.isActive,
      employmentStatus: employee.employmentStatus,
      hasNonTerminalSeparation: Boolean(
        separation && isNonTerminalSeparationStatus(separation.status),
      ),
      hasStartedClearance: Boolean(separation?.clearance),
    });

    return employee;
  }

  private async createAssignment(
    tx: DbClient,
    data: {
      companyId: string;
      employeeId: string;
      assetId: string;
      assignedDate: Date;
      assignedByUserId: string;
      branchIdAtAssignment: string;
      departmentIdAtAssignment: string;
      remarks: string | null;
    },
  ) {
    try {
      return await tx.employeeAsset.create({
        data: {
          ...data,
          status: 'ASSIGNED',
          custodyStatus: EmployeeAssetStatus.ASSIGNED,
          sourceType: 'MANUAL',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainConflictException(
          ASSET_ERROR_CODES.ASSET_ALREADY_ASSIGNED,
          'Asset is already assigned to an employee',
        );
      }

      throw error;
    }
  }

  private async reconcileLinkedRecords(
    tx: DbClient,
    input: {
      employeeAssetId?: string | null;
      licenseAllocationId?: string | null;
      resolutionType: string;
      userId: string;
      at: Date;
    },
  ) {
    if (input.employeeAssetId) {
      await tx.assetCustodyRequest.updateMany({
        where: {
          employeeAssetId: input.employeeAssetId,
          status: { in: ['SUBMITTED', 'IN_REVIEW'] },
        },
        data: {
          status: 'COMPLETED',
          resolvedAt: input.at,
          resolvedByUserId: input.userId,
          version: { increment: 1 },
        },
      });
      await tx.assetClearanceItem.updateMany({
        where: {
          employeeAssetId: input.employeeAssetId,
          status: 'OPEN',
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: input.at,
          resolutionType: input.resolutionType as never,
        },
      });
    }

    if (input.licenseAllocationId) {
      await tx.assetCustodyRequest.updateMany({
        where: {
          licenseAllocationId: input.licenseAllocationId,
          status: { in: ['SUBMITTED', 'IN_REVIEW'] },
        },
        data: {
          status: 'COMPLETED',
          resolvedAt: input.at,
          resolvedByUserId: input.userId,
          version: { increment: 1 },
        },
      });
      await tx.assetClearanceItem.updateMany({
        where: {
          licenseAllocationId: input.licenseAllocationId,
          status: 'OPEN',
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: input.at,
          resolutionType: 'REVOKED',
        },
      });
    }
  }

  private lifecycleForOutcome(outcome: AssetCustodyCloseOutcome) {
    switch (outcome) {
      case AssetCustodyCloseOutcome.DAMAGED:
        return AssetLifecycleStatus.IN_REPAIR;
      case AssetCustodyCloseOutcome.LOST:
        return AssetLifecycleStatus.LOST;
      default:
        return AssetLifecycleStatus.ACTIVE;
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
