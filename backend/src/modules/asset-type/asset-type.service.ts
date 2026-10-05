import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';
import { OrganizationScopeService } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';

@Injectable()
export class AssetTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(dto: CreateAssetTypeDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.scope.assertAssetCategoryInScope(
      dto.assetCategoryId,
      dto.companyId,
    );

    const existingName = await this.prisma.assetType.findFirst({
      where: {
        companyId: dto.companyId,
        assetTypeName: dto.assetTypeName,
      },
    });

    if (existingName) {
      throw new BadRequestException('Asset type name already exists');
    }

    const assetTypeCode = await this.numberSeries.next(
      'ASSET_TYPE',
      dto.companyId,
      'AT',
    );

    return this.prisma.$transaction(async (tx) => {
      const assetType = await tx.assetType.create({
        data: {
          companyId: dto.companyId,
          assetCategoryId: dto.assetCategoryId,
          assetTypeName: dto.assetTypeName,
          description: dto.description,
          kind: dto.kind,
          trackingMode: dto.trackingMode,
          assetTypeCode,
        },
      });

      await this.auditService.log(
        'Asset Type',
        assetType.id,
        'CREATE',
        null,
        assetType,
        { tx },
      );

      return assetType;
    });
  }

  async findAll(companyId?: string, assetCategoryId?: string) {
    if (companyId) {
      await this.organizationScope.assertCurrentCompany(companyId);
    }
    if (assetCategoryId) {
      await this.scope.assertAssetCategoryInScope(assetCategoryId, companyId);
    }

    return this.prisma.assetType.findMany({
      where: {
        ...this.scope.assetTypeWhere(),
        ...(companyId && { companyId }),
        ...(assetCategoryId && { assetCategoryId }),
      },

      include: {
        company: true,
        assetCategory: true,
      },

      orderBy: {
        assetTypeName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const assetType = await this.prisma.assetType.findFirst({
      where: {
        id,
        ...this.scope.assetTypeWhere(),
      },
      include: {
        company: true,
        assetCategory: true,
      },
    });

    if (!assetType) {
      throw new NotFoundException('Asset type not found');
    }

    return assetType;
  }

  async update(id: string, dto: UpdateAssetTypeDto) {
    const oldAssetType = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updatedAssetType = await tx.assetType.update({
        where: { id },
        data: {
          assetCategoryId: dto.assetCategoryId,
          assetTypeName: dto.assetTypeName,
          description: dto.description,
          kind: dto.kind,
          trackingMode: dto.trackingMode,
        },
      });

      await this.auditService.log(
        'Asset Type',
        id,
        'UPDATE',
        oldAssetType,
        updatedAssetType,
        { tx },
      );

      return updatedAssetType;
    });
  }

  async remove(id: string) {
    const assetType = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await this.auditService.log('Asset Type', id, 'DELETE', assetType, null, {
        tx,
      });

      return tx.assetType.delete({
        where: { id },
      });
    });
  }
}
