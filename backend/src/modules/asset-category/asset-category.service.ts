import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';
import { OrganizationScopeService } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';

@Injectable()
export class AssetCategoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(dto: CreateAssetCategoryDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const existingName = await this.prisma.assetCategory.findFirst({
      where: {
        companyId: dto.companyId,
        assetCategoryName: dto.assetCategoryName,
      },
    });

    if (existingName) {
      throw new ConflictException('Asset category name already exists.');
    }

    const assetCategoryCode = await this.numberSeries.next(
      'ASSET_CATEGORY',
      dto.companyId,
      'AC',
    );

    return this.prisma.$transaction(async (tx) => {
      const assetCategory = await tx.assetCategory.create({
        data: {
          companyId: dto.companyId,
          assetCategoryName: dto.assetCategoryName,
          description: dto.description,
          assetCategoryCode,
        },
      });

      await this.auditService.log(
        'Asset Category',
        assetCategory.id,
        'CREATE',
        null,
        assetCategory,
        { tx },
      );

      return assetCategory;
    });
  }

  async findAll(companyId?: string) {
    if (companyId) {
      await this.organizationScope.assertCurrentCompany(companyId);
    }

    return this.prisma.assetCategory.findMany({
      where: {
        ...this.scope.assetCategoryWhere(),
        ...(companyId ? { companyId } : {}),
      },

      include: {
        company: true,
      },

      orderBy: {
        assetCategoryName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const assetCategory = await this.prisma.assetCategory.findFirst({
      where: {
        id,
        ...this.scope.assetCategoryWhere(),
      },

      include: {
        company: true,
      },
    });

    if (!assetCategory) {
      throw new NotFoundException('Asset category not found');
    }

    return assetCategory;
  }

  async update(id: string, dto: UpdateAssetCategoryDto) {
    const oldAssetCategory = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updatedAssetCategory = await tx.assetCategory.update({
        where: { id },
        data: {
          assetCategoryName: dto.assetCategoryName,
          description: dto.description,
        },
      });

      await this.auditService.log(
        'Asset Category',
        id,
        'UPDATE',
        oldAssetCategory,
        updatedAssetCategory,
        { tx },
      );

      return updatedAssetCategory;
    });
  }

  async remove(id: string) {
    const assetCategory = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await this.auditService.log(
        'Asset Category',
        id,
        'DELETE',
        assetCategory,
        null,
        { tx },
      );

      return tx.assetCategory.delete({
        where: { id },
      });
    });
  }
}
