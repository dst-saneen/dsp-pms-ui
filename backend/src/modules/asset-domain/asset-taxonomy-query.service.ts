import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetCapabilityService } from './asset-capability.service';
import { AssetResponseMapper } from './asset-response.mapper';
import { SearchAssetCategoryDto } from './dto/search-asset-category.dto';
import { SearchAssetTypeDto } from './dto/search-asset-type.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import {
  ASSET_SORT_ALLOWLISTS,
  ASSET_SORT_DEFAULTS,
  assetOrderBy,
  resolveAssetSortField,
  resolveAssetSortOrder,
} from './policies/asset-sort-allowlists';

@Injectable()
export class AssetTaxonomyQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly capabilities: AssetCapabilityService,
    private readonly mapper: AssetResponseMapper,
  ) {}

  async findCategoryPage(
    query: SearchAssetCategoryDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canReadTaxonomy(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const where = this.buildCategoryWhere(query);

    const sortBy = resolveAssetSortField(
      query.sortBy,
      ASSET_SORT_ALLOWLISTS.category,
      ASSET_SORT_DEFAULTS.category.sortBy,
    );
    const sortOrder = resolveAssetSortOrder(
      query.sortOrder,
      ASSET_SORT_DEFAULTS.category.sortOrder,
    );

    const [rows, total] = await Promise.all([
      this.prisma.assetCategory.findMany({
        where,
        include: {
          company: { select: { id: true, companyName: true } },
          _count: { select: { assetTypes: true } },
        },
        orderBy: assetOrderBy(sortBy, sortOrder),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetCategory.count({ where }),
    ]);

    const items = rows.map((category) =>
      this.mapper.toCategoryResponse(
        category,
        category._count.assetTypes,
        this.capabilities.getCategoryAllowedActions(category, context),
      ),
    );

    return this.mapper.toPaginatedInventory(
      items,
      total,
      query.page,
      query.limit,
    );
  }

  async findCategoryDetail(id: string, context: AssetAccessContext) {
    if (!this.access.canReadTaxonomy(context)) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CATEGORY_NOT_FOUND,
        'Asset category not found',
      );
    }

    const category = await this.prisma.assetCategory.findFirst({
      where: {
        id,
        ...this.organizationScope.assetCategoryWhere(),
      },
      include: {
        company: { select: { id: true, companyName: true } },
        _count: { select: { assetTypes: true } },
      },
    });

    if (!category) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CATEGORY_NOT_FOUND,
        'Asset category not found',
      );
    }

    return this.mapper.toCategoryResponse(
      category,
      category._count.assetTypes,
      this.capabilities.getCategoryAllowedActions(category, context),
    );
  }

  async findTypePage(query: SearchAssetTypeDto, context: AssetAccessContext) {
    if (!this.access.canReadTaxonomy(context)) {
      return this.mapper.toPaginatedInventory([], 0, query.page, query.limit);
    }

    const where = this.buildTypeWhere(query);

    const sortBy = resolveAssetSortField(
      query.sortBy,
      ASSET_SORT_ALLOWLISTS.type,
      ASSET_SORT_DEFAULTS.type.sortBy,
    );
    const sortOrder = resolveAssetSortOrder(
      query.sortOrder,
      ASSET_SORT_DEFAULTS.type.sortOrder,
    );

    const [rows, total] = await Promise.all([
      this.prisma.assetType.findMany({
        where,
        include: {
          company: { select: { id: true, companyName: true } },
          assetCategory: { select: { id: true, assetCategoryName: true } },
          _count: { select: { assets: true } },
        },
        orderBy: assetOrderBy(sortBy, sortOrder),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetType.count({ where }),
    ]);

    const items = rows.map((assetType) =>
      this.mapper.toTypeResponse(
        assetType,
        assetType._count.assets,
        this.capabilities.getTypeAllowedActions(assetType, context),
      ),
    );

    return this.mapper.toPaginatedInventory(
      items,
      total,
      query.page,
      query.limit,
    );
  }

  async findTypeDetail(id: string, context: AssetAccessContext) {
    if (!this.access.canReadTaxonomy(context)) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_TYPE_NOT_FOUND,
        'Asset type not found',
      );
    }

    const assetType = await this.prisma.assetType.findFirst({
      where: {
        id,
        ...this.organizationScope.assetTypeWhere(),
      },
      include: {
        company: { select: { id: true, companyName: true } },
        assetCategory: { select: { id: true, assetCategoryName: true } },
        _count: { select: { assets: true } },
      },
    });

    if (!assetType) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_TYPE_NOT_FOUND,
        'Asset type not found',
      );
    }

    return this.mapper.toTypeResponse(
      assetType,
      assetType._count.assets,
      this.capabilities.getTypeAllowedActions(assetType, context),
    );
  }

  private buildCategoryWhere(
    query: SearchAssetCategoryDto,
  ): Prisma.AssetCategoryWhereInput {
    const where: Prisma.AssetCategoryWhereInput = {
      ...this.organizationScope.assetCategoryWhere(),
      ...(query.companyId ? { companyId: query.companyId } : {}),
    };

    if (!query.includeInactive) {
      where.isActive = true;
      where.archivedAt = null;
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { assetCategoryCode: { contains: keyword, mode: 'insensitive' } },
        { assetCategoryName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildTypeWhere(
    query: SearchAssetTypeDto,
  ): Prisma.AssetTypeWhereInput {
    const where: Prisma.AssetTypeWhereInput = {
      ...this.organizationScope.assetTypeWhere(),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.assetCategoryId
        ? { assetCategoryId: query.assetCategoryId }
        : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.trackingMode ? { trackingMode: query.trackingMode } : {}),
    };

    if (!query.includeInactive) {
      where.isActive = true;
      where.archivedAt = null;
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { assetTypeCode: { contains: keyword, mode: 'insensitive' } },
        { assetTypeName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
