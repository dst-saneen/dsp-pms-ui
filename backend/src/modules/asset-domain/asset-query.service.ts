import { Injectable } from '@nestjs/common';
import {
  AssetLifecycleStatus,
  AssetTrackingMode,
  Prisma,
} from '@prisma/client';

import { SortOrder } from '../../common/enums';
import { DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetCapabilityService } from './asset-capability.service';
import { ASSET_INVENTORY_LIST_INCLUDE } from './asset-domain.constants';
import { SearchAssetHistoryDto } from './dto/search-asset-history.dto';
import { SearchAssetInventoryDto } from './dto/search-asset-inventory.dto';
import { SearchEligibleEmployeesDto } from './dto/search-eligible-employees.dto';
import { SearchEligibleForAssignmentDto } from './dto/search-eligible-for-assignment.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import { buildAssetAvailabilityWhere } from './policies/asset-availability.util';
import {
  ELIGIBLE_EMPLOYMENT_STATUS_LIST,
  isEmployeeEligibleForAssetQuery,
  isNonTerminalSeparationStatus,
} from './policies/asset-employee-eligibility';
import { kindsForCatalog } from './policies/asset-kind-tracking';
import {
  ASSET_SORT_ALLOWLISTS,
  ASSET_SORT_DEFAULTS,
  assetOrderBy,
  resolveAssetSortField,
  resolveAssetSortOrder,
} from './policies/asset-sort-allowlists';
import { AssetResponseMapper } from './asset-response.mapper';

@Injectable()
export class AssetQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly capabilities: AssetCapabilityService,
    private readonly mapper: AssetResponseMapper,
    private readonly organizationScope: EmployeeDomainScopeService,
  ) {}

  async findInventoryPage(
    query: SearchAssetInventoryDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canReadInventory(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const where = await this.buildInventoryWhere(query, context);

    const sortBy = resolveAssetSortField(
      query.sortBy,
      ASSET_SORT_ALLOWLISTS.asset,
      ASSET_SORT_DEFAULTS.asset.sortBy,
    );
    const sortOrder = resolveAssetSortOrder(
      query.sortOrder,
      ASSET_SORT_DEFAULTS.asset.sortOrder,
    );

    const [rows, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: ASSET_INVENTORY_LIST_INCLUDE,
        orderBy: assetOrderBy(sortBy, sortOrder),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.asset.count({ where }),
    ]);

    const items = rows.map((asset) =>
      this.mapper.toInventoryListItem(
        asset,
        this.capabilities.getInventoryAllowedActions(asset, context),
      ),
    );

    return this.mapper.toPaginatedInventory(
      items,
      total,
      query.page,
      query.limit,
    );
  }

  async findInventoryDetail(id: string, context: AssetAccessContext) {
    await this.access.assertAssetInventoryReadable(id, context);

    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        ...(await this.access.buildAssetInventoryWhere(context)),
      },
      include: ASSET_INVENTORY_LIST_INCLUDE,
    });

    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }

    return this.mapper.toInventoryDetail(
      asset,
      this.capabilities.getInventoryAllowedActions(asset, context),
    );
  }

  async summarizeInventory(context: AssetAccessContext) {
    if (!this.access.canReadInventory(context)) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        assigned: 0,
      };
    }

    const where = await this.access.buildAssetInventoryWhere(context);

    const [total, active, inactive, assigned] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.count({
        where: { ...where, isActive: true, archivedAt: null },
      }),
      this.prisma.asset.count({
        where: {
          ...where,
          OR: [{ isActive: false }, { archivedAt: { not: null } }],
        },
      }),
      this.prisma.asset.count({
        where: {
          ...where,
          status: 'ASSIGNED',
        },
      }),
    ]);

    return { total, active, inactive, assigned };
  }

  async findInventoryHistory(
    assetId: string,
    query: SearchAssetHistoryDto,
    context: AssetAccessContext,
  ) {
    await this.access.assertAssetInventoryReadable(assetId, context);

    const where: Prisma.AssetDomainActionEventWhereInput = {
      assetId,
      ...(context.activeCompanyId
        ? { companyId: context.activeCompanyId }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.assetDomainActionEvent.findMany({
        where,
        include: {
          actorUser: {
            select: { id: true, displayName: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetDomainActionEvent.count({ where }),
    ]);

    const includePrivate = this.access.canReadPrivateHistory(context);
    const items = rows.map((event) =>
      this.mapper.toHistoryEvent(event, includePrivate),
    );

    return this.mapper.toPaginatedInventory(
      items,
      total,
      query.page,
      query.limit,
    );
  }

  async findEligibleEmployees(
    query: SearchEligibleEmployeesDto,
    context: AssetAccessContext,
  ) {
    if (
      !this.access.canReadCustody(context) &&
      !this.access.canManageCustody(context)
    ) {
      return this.mapper.toPaginatedSafeEmployees(
        [],
        0,
        query.page,
        query.limit,
      );
    }

    const asset = await this.prisma.asset.findFirst({
      where: {
        id: query.assetId,
        ...(await this.access.buildCustodyAssetWhere(context, 'manage')),
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        trackingMode: true,
      },
    });

    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {
      ...this.organizationScope.employeeWhere(),
      companyId: asset.companyId,
      isActive: true,
      employmentStatus: { in: [...ELIGIBLE_EMPLOYMENT_STATUS_LIST] },
    };

    if (asset.trackingMode !== AssetTrackingMode.POOL) {
      employeeWhere.branchId = asset.branchId;
    }

    const rows = await this.prisma.employee.findMany({
      where: employeeWhere,
      include: {
        separations: {
          where: { status: { in: ['SUBMITTED', 'APPROVED'] } },
          include: { clearance: true },
          take: 1,
        },
      },
      orderBy: [{ firstName: SortOrder.ASC }, { lastName: SortOrder.ASC }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const eligible = rows.filter((employee) => {
      const separation = employee.separations[0];
      return isEmployeeEligibleForAssetQuery({
        isActive: employee.isActive,
        employmentStatus: employee.employmentStatus,
        hasNonTerminalSeparation: Boolean(
          separation && isNonTerminalSeparationStatus(separation.status),
        ),
        hasStartedClearance: Boolean(separation?.clearance),
      });
    });

    return this.mapper.toPaginatedSafeEmployees(
      eligible,
      eligible.length,
      query.page,
      query.limit,
    );
  }

  async findEligibleForAssignment(
    query: SearchEligibleForAssignmentDto,
    context: AssetAccessContext,
  ) {
    if (
      !this.access.canReadCustody(context) &&
      !this.access.canManageCustody(context)
    ) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const employee = await this.organizationScope
      .assertEmployeeInScope(query.employeeId)
      .catch(() => {
        throw new DomainNotFoundException(
          ASSET_ERROR_CODES.ASSET_EMPLOYEE_NOT_FOUND,
          'Employee not found',
        );
      });

    const separation = await this.prisma.employeeSeparation.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      include: { clearance: true },
    });

    if (
      !isEmployeeEligibleForAssetQuery({
        isActive: employee.isActive,
        employmentStatus: employee.employmentStatus,
        hasNonTerminalSeparation: Boolean(
          separation && isNonTerminalSeparationStatus(separation.status),
        ),
        hasStartedClearance: Boolean(separation?.clearance),
      })
    ) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const where: Prisma.AssetWhereInput = {
      ...(await this.access.buildCustodyAssetWhere(context, 'manage')),
      trackingMode: AssetTrackingMode.INDIVIDUAL,
      lifecycleStatus: AssetLifecycleStatus.ACTIVE,
      isActive: true,
      archivedAt: null,
      status: 'AVAILABLE',
      NOT: {
        employeeAssets: {
          some: {
            custodyStatus: 'ASSIGNED',
            closedAt: null,
          },
        },
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: ASSET_INVENTORY_LIST_INCLUDE,
        orderBy: [{ assetCode: SortOrder.ASC }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.asset.count({ where }),
    ]);

    const items = rows
      .map((asset) =>
        this.mapper.toInventoryListItem(
          asset,
          this.capabilities.getInventoryAllowedActions(asset, context),
        ),
      )
      .filter((item) => item.allowedActions.includes('ASSIGN'));

    return this.mapper.toPaginatedInventory(
      items,
      total,
      query.page,
      query.limit,
    );
  }

  private async buildInventoryWhere(
    query: SearchAssetInventoryDto,
    context: AssetAccessContext,
  ): Promise<Prisma.AssetWhereInput> {
    const where = await this.access.buildAssetInventoryWhere(context, {
      departmentId: query.departmentId,
      branchId: query.branchId,
    });

    if (!query.includeInactive) {
      where.isActive = true;
      where.archivedAt = null;
    }

    if (query.kind) {
      where.kind = query.kind;
    } else if (query.catalog) {
      where.kind = { in: kindsForCatalog(query.catalog) };
    }

    if (query.trackingMode) {
      where.trackingMode = query.trackingMode;
    }

    if (query.lifecycleStatus) {
      where.lifecycleStatus = query.lifecycleStatus;
    }

    if (query.assetTypeId) {
      where.assetTypeId = query.assetTypeId;
    }

    if (query.assetCategoryId) {
      where.assetType = { assetCategoryId: query.assetCategoryId };
    }

    const andFilters: Prisma.AssetWhereInput[] = [];

    if (query.availabilityStatus) {
      andFilters.push(buildAssetAvailabilityWhere(query.availabilityStatus));
    }

    if (query.expiringBefore) {
      const before = new Date(query.expiringBefore);
      andFilters.push({
        OR: [
          { warrantyExpiry: { lte: before } },
          {
            softwareLicenseDetail: {
              expiresOn: { lte: before },
            },
          },
        ],
      });
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      andFilters.push({
        OR: [
          { assetCode: { contains: keyword, mode: 'insensitive' } },
          { assetName: { contains: keyword, mode: 'insensitive' } },
          { serialNumber: { contains: keyword, mode: 'insensitive' } },
          { location: { contains: keyword, mode: 'insensitive' } },
          {
            assetType: {
              assetTypeName: { contains: keyword, mode: 'insensitive' },
            },
          },
          {
            department: {
              departmentName: { contains: keyword, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    return where;
  }
}
