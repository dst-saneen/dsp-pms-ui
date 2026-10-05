import { ForbiddenException, Injectable } from '@nestjs/common';
import { LicenseAllocationStatus, Prisma } from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetAuditMapper } from './asset-audit.mapper';
import { AssetCapabilityService } from './asset-capability.service';
import { ASSET_LICENSE_ALLOCATION_DETAIL_INCLUDE } from './asset-domain.constants';
import { AssetIdempotencyService } from './asset-idempotency.service';
import {
  ASSET_NOTIFICATION_EVENT,
  AssetNotificationService,
} from './asset-notification.service';
import { AssetResponseMapper } from './asset-response.mapper';
import { AcknowledgeCustodyCommandDto } from './dto/assign-employee-asset-command.dto';
import {
  AllocateLicenseCommandDto,
  RevokeLicenseCommandDto,
  SearchLicenseAllocationDto,
} from './dto/license-allocation-command.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import {
  hashAssetSourceCommand,
  type InternalAssetFulfillmentInput,
} from './policies/asset-source-command';
import {
  assertEffectiveDateWindow,
  assertEmployeeEligibleForAsset,
  assertLicensePoolAllocatable,
  isNonTerminalSeparationStatus,
  isPastCalendarDate,
} from './policies/asset-employee-eligibility';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class LicenseAllocationService {
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

  async allocate(
    assetId: string,
    dto: AllocateLicenseCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageCustody(context)) {
      throw new ForbiddenException();
    }
    await this.access.assertLicensePoolScope(context);

    const companyId = context.activeCompanyId ?? 'unknown';

    return this.idempotency.execute(
      context,
      companyId,
      'ALLOCATE_LICENSE',
      { assetId, ...dto },
      async (tx) => {
        const employee = await this.loadEligibleEmployee(tx, dto.employeeId);
        const asset = await tx.asset.findFirst({
          where: {
            id: assetId,
            ...(await this.access.buildCustodyAssetWhere(context, 'manage')),
          },
          include: { softwareLicenseDetail: true },
        });

        if (!asset) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_NOT_FOUND,
            'Asset not found',
          );
        }

        if (employee.companyId !== asset.companyId) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_EMPLOYEE_NOT_FOUND,
            'Employee not found',
          );
        }

        assertLicensePoolAllocatable(asset);
        this.assertExpectedVersion(asset.version, dto.expectedPoolVersion);

        if (isPastCalendarDate(asset.softwareLicenseDetail?.expiresOn)) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_EXPIRED,
            'Licence pool is expired',
          );
        }

        const existing = await tx.softwareLicenseAllocation.findFirst({
          where: {
            assetId,
            employeeId: employee.id,
            status: LicenseAllocationStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (existing) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.LICENSE_ALLOCATION_EXISTS,
            'Employee already has an active seat on this pool',
          );
        }

        const claimed = await tx.$queryRaw<
          Array<{ allocatedSeatCount: number }>
        >(
          Prisma.sql`
            UPDATE "asset_software_license_details"
            SET "allocatedSeatCount" = "allocatedSeatCount" + 1,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "assetId" = ${assetId}
              AND "allocatedSeatCount" < "seatCapacity"
            RETURNING "allocatedSeatCount"
          `,
        );

        if (claimed.length !== 1) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.LICENSE_NO_SEATS_AVAILABLE,
            'No licence seats are available',
          );
        }

        const created = await this.createAllocation(tx, {
          companyId: asset.companyId,
          assetId,
          employeeId: employee.id,
          allocatedAt: new Date(dto.allocatedDate),
          allocatedByUserId: context.userId,
          remarks: dto.remarks?.trim() || null,
        });

        await tx.asset.update({
          where: { id: assetId },
          data: { version: { increment: 1 } },
        });

        await this.auditService.log(
          'SoftwareLicenseAllocation',
          created.id,
          'ALLOCATE',
          null,
          this.auditMapper.toSafeSnapshot(created),
          { tx, userId: context.userId },
        );

        await this.notifications.enqueue(
          tx,
          ASSET_NOTIFICATION_EVENT.LICENSE_ALLOCATED,
          'SoftwareLicenseAllocation',
          created.id,
          {
            companyId: asset.companyId,
            branchId: asset.branchId,
            departmentId: asset.departmentId ?? undefined,
            employeeId: employee.id,
            assetId,
            licenseAllocationId: created.id,
            status: 'ACTIVE',
          },
          `asset-license-allocated:${created.id}`,
        );

        return this.idempotency.commandMeta('LICENSE_ALLOCATION', created.id);
      },
      (id) => this.findDetail(id, context),
    );
  }

  async allocateWithinTransaction(
    tx: DbClient,
    assetId: string,
    input: InternalAssetFulfillmentInput,
  ) {
    const employee = await this.loadEligibleEmployee(tx, input.employeeId);
    const asset = await tx.asset.findFirst({
      where: { id: assetId, companyId: employee.companyId },
      include: { softwareLicenseDetail: true },
    });
    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }
    assertLicensePoolAllocatable(asset);
    this.assertExpectedVersion(asset.version, input.expectedAssetVersion);

    const sourceCommandHash = hashAssetSourceCommand({
      companyId: asset.companyId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceCommandKey: input.sourceCommandKey,
      employeeId: employee.id,
      assetId,
      effectiveDate: input.effectiveDate,
      commandKind: 'ALLOCATE',
    });

    const existing = await tx.softwareLicenseAllocation.findFirst({
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

    const inserted = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        INSERT INTO "software_license_allocations" (
          "id", "companyId", "assetId", "employeeId", "status",
          "allocatedAt", "allocatedByUserId", "sourceType", "sourceId",
          "sourceCommandKey", "sourceCommandHash", "version",
          "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), ${asset.companyId}, ${assetId}, ${employee.id},
          'ACTIVE'::"LicenseAllocationStatus", ${new Date(input.effectiveDate)},
          ${input.actorUserId}, ${Prisma.raw(`'${input.sourceType}'::"AssetSourceType"`)},
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
      const raced = await tx.softwareLicenseAllocation.findFirst({
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

    const claimed = await tx.$queryRaw<Array<{ allocatedSeatCount: number }>>(
      Prisma.sql`
        UPDATE "asset_software_license_details"
        SET "allocatedSeatCount" = "allocatedSeatCount" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "assetId" = ${assetId}
          AND "allocatedSeatCount" < "seatCapacity"
        RETURNING "allocatedSeatCount"
      `,
    );
    if (claimed.length !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.LICENSE_NO_SEATS_AVAILABLE,
        'No licence seats are available',
      );
    }

    await tx.asset.update({
      where: { id: assetId },
      data: { version: { increment: 1 } },
    });

    return tx.softwareLicenseAllocation.findFirstOrThrow({
      where: { id: inserted[0].id },
    });
  }

  async revoke(
    id: string,
    dto: RevokeLicenseCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageCustody(context)) {
      throw new ForbiddenException();
    }
    await this.access.assertLicensePoolScope(context);

    const companyId = context.activeCompanyId ?? 'unknown';

    return this.idempotency.execute(
      context,
      companyId,
      'REVOKE_LICENSE',
      { id, ...dto },
      async (tx) => {
        await this.revokeInTransaction(tx, id, dto, context);
        return this.idempotency.commandMeta('LICENSE_ALLOCATION', id);
      },
      () => this.findDetail(id, context),
    );
  }

  async revokeInTransaction(
    tx: DbClient,
    id: string,
    dto: RevokeLicenseCommandDto,
    context: AssetAccessContext,
  ) {
    const revokedDate = new Date(dto.revokedDate);
    const allocation = await tx.softwareLicenseAllocation.findFirst({
      where: {
        id,
        asset: await this.access.buildCustodyAssetWhere(context, 'manage'),
      },
      include: { asset: true },
    });

    if (!allocation) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_NOT_FOUND,
        'Licence allocation not found',
      );
    }

    this.assertExpectedVersion(
      allocation.version,
      dto.expectedAllocationVersion,
    );
    this.assertExpectedVersion(
      allocation.asset.version,
      dto.expectedPoolVersion,
    );

    if (allocation.status !== LicenseAllocationStatus.ACTIVE) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_ALREADY_CLOSED,
        'Licence allocation is already closed',
      );
    }

    assertEffectiveDateWindow({
      startDate: allocation.allocatedAt,
      effectiveDate: revokedDate,
    });

    const closed = await tx.softwareLicenseAllocation.updateMany({
      where: {
        id,
        status: LicenseAllocationStatus.ACTIVE,
        version: allocation.version,
      },
      data: {
        status: LicenseAllocationStatus.REVOKED,
        revokedAt: revokedDate,
        revokedByUserId: context.userId,
        version: { increment: 1 },
      },
    });

    if (closed.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_ALREADY_CLOSED,
        'Licence allocation is already closed',
      );
    }

    await this.releaseSeat(tx, allocation.assetId);

    const bumped = await tx.asset.updateMany({
      where: { id: allocation.assetId, version: allocation.asset.version },
      data: { version: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }

    await tx.assetCustodyRequest.updateMany({
      where: {
        licenseAllocationId: id,
        status: { in: ['SUBMITTED', 'IN_REVIEW'] },
      },
      data: {
        status: 'COMPLETED',
        resolvedAt: revokedDate,
        resolvedByUserId: context.userId,
        version: { increment: 1 },
      },
    });
    await tx.assetClearanceItem.updateMany({
      where: { licenseAllocationId: id, status: 'OPEN' },
      data: {
        status: 'RESOLVED',
        resolvedAt: revokedDate,
        resolutionType: 'REVOKED',
      },
    });

    await this.auditService.log(
      'SoftwareLicenseAllocation',
      id,
      'REVOKE',
      allocation,
      { reason: dto.reason },
      { tx, userId: context.userId },
    );
  }

  async waiveInTransaction(
    tx: DbClient,
    id: string,
    context: AssetAccessContext,
    expectedAllocationVersion: number,
    expectedAssetVersion: number,
  ) {
    const allocation = await tx.softwareLicenseAllocation.findFirst({
      where: { id },
      include: { asset: true },
    });
    if (!allocation) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_NOT_FOUND,
        'Licence allocation not found',
      );
    }
    this.assertExpectedVersion(allocation.version, expectedAllocationVersion);
    this.assertExpectedVersion(allocation.asset.version, expectedAssetVersion);

    const now = new Date();
    const closed = await tx.softwareLicenseAllocation.updateMany({
      where: {
        id,
        status: LicenseAllocationStatus.ACTIVE,
        version: allocation.version,
      },
      data: {
        status: LicenseAllocationStatus.WAIVED,
        revokedAt: now,
        revokedByUserId: context.userId,
        version: { increment: 1 },
      },
    });
    if (closed.count !== 1) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_ALREADY_CLOSED,
        'Licence allocation is already closed',
      );
    }

    await this.releaseSeat(tx, allocation.assetId);
    await tx.asset.updateMany({
      where: { id: allocation.assetId, version: allocation.asset.version },
      data: { version: { increment: 1 } },
    });
  }

  private async releaseSeat(tx: DbClient, assetId: string) {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "asset_software_license_details"
        SET "allocatedSeatCount" = GREATEST("allocatedSeatCount" - 1, 0),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "assetId" = ${assetId}
      `,
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
        'Only the allocated employee can acknowledge this licence',
      );
    }

    const companyId = context.activeCompanyId ?? 'unknown';

    return this.idempotency.execute(
      context,
      companyId,
      'ACKNOWLEDGE_LICENSE_ALLOCATION',
      { id, ...dto },
      async (tx) => {
        const allocation = await tx.softwareLicenseAllocation.findFirst({
          where: { id },
        });

        if (!allocation) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.LICENSE_ALLOCATION_NOT_FOUND,
            'Licence allocation not found',
          );
        }

        if (allocation.employeeId !== context.employeeId) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH,
            'Only the allocated employee can acknowledge this licence',
          );
        }

        this.assertExpectedVersion(allocation.version, dto.expectedVersion);

        if (allocation.acknowledgedAt) {
          return this.idempotency.commandMeta('LICENSE_ALLOCATION', id);
        }

        await tx.softwareLicenseAllocation.update({
          where: { id },
          data: {
            acknowledgedAt: new Date(),
            acknowledgedByUserId: context.userId,
          },
        });

        return this.idempotency.commandMeta('LICENSE_ALLOCATION', id);
      },
      () => this.findSelfDetail(id, context.employeeId!),
    );
  }

  async findPage(
    query: SearchLicenseAllocationDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canReadCustody(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const assetWhere: Prisma.AssetWhereInput = {
      ...(await this.access.buildCustodyAssetWhere(context, 'read')),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    };
    const where: Prisma.SoftwareLicenseAllocationWhereInput = {
      asset: assetWhere,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (!query.includeInactive && !query.status) {
      where.status = LicenseAllocationStatus.ACTIVE;
    }

    const [rows, total] = await Promise.all([
      this.prisma.softwareLicenseAllocation.findMany({
        where,
        include: ASSET_LICENSE_ALLOCATION_DETAIL_INCLUDE,
        orderBy: [{ allocatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.softwareLicenseAllocation.count({ where }),
    ]);

    return this.mapper.toPaginatedInventory(
      rows.map((row) =>
        this.mapper.toLicenseAllocationResponse(
          row,
          this.capabilities.getLicenseAllocationAllowedActions(row, {
            isSelfService: false,
            canManageCustody: this.access.canManageCustody(context),
          }),
        ),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async findDetail(id: string, context: AssetAccessContext) {
    const allocation = await this.prisma.softwareLicenseAllocation.findFirst({
      where: {
        id,
        asset: await this.access.buildCustodyAssetWhere(context, 'read'),
      },
      include: ASSET_LICENSE_ALLOCATION_DETAIL_INCLUDE,
    });

    if (!allocation) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_NOT_FOUND,
        'Licence allocation not found',
      );
    }

    return this.mapper.toLicenseAllocationResponse(
      allocation,
      this.capabilities.getLicenseAllocationAllowedActions(allocation, {
        isSelfService: false,
        canManageCustody: this.access.canManageCustody(context),
      }),
    );
  }

  private async findSelfDetail(id: string, employeeId: string) {
    const allocation = await this.prisma.softwareLicenseAllocation.findFirst({
      where: { id, employeeId },
      include: ASSET_LICENSE_ALLOCATION_DETAIL_INCLUDE,
    });

    if (!allocation) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.LICENSE_ALLOCATION_NOT_FOUND,
        'Licence allocation not found',
      );
    }

    return this.mapper.toLicenseAllocationResponse(
      allocation,
      this.capabilities.getLicenseAllocationAllowedActions(allocation, {
        isSelfService: true,
      }),
    );
  }

  private async createAllocation(
    tx: DbClient,
    data: {
      companyId: string;
      assetId: string;
      employeeId: string;
      allocatedAt: Date;
      allocatedByUserId: string;
      remarks: string | null;
    },
  ) {
    try {
      return await tx.softwareLicenseAllocation.create({
        data: {
          ...data,
          status: LicenseAllocationStatus.ACTIVE,
          sourceType: 'MANUAL',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainConflictException(
          ASSET_ERROR_CODES.LICENSE_ALLOCATION_EXISTS,
          'Employee already has an active seat on this pool',
        );
      }

      throw error;
    }
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

  private assertExpectedVersion(actual: number, expected?: number) {
    if (expected !== undefined && expected !== actual) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }
  }
}
