import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';

import { CreateCompanyGroupDto } from './dto/create-company-group.dto';

import { UpdateCompanyGroupDto } from './dto/update-company-group.dto';
import { OrganizationScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';

@Injectable()
export class CompanyGroupService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(dto: CreateCompanyGroupDto) {
    if (!this.organizationScope.current().isGlobal) {
      throw new ForbiddenException(
        'Only a global administrator can create a Company Group.',
      );
    }

    const groupCode = await this.numberSeries.next(
      'COMPANY_GROUP',
      'GLOBAL',
      'GRP',
    );
    const group = await this.prisma.companyGroup.create({
      data: {
        ...dto,
        groupCode,
      },
    });

    await this.auditService.log(
      'CompanyGroup',
      group.id,
      'CREATE',
      null,
      group,
    );

    return group;
  }

  async findAll() {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();

    return this.prisma.companyGroup.findMany({
      where: companyGroupId ? { id: companyGroupId } : undefined,
      orderBy: {
        groupName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();

    if (companyGroupId && companyGroupId !== id) {
      throw new NotFoundException('Company Group not found');
    }

    const group = await this.prisma.companyGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Company Group not found');
    }

    return group;
  }

  async update(id: string, dto: UpdateCompanyGroupDto) {
    const oldGroup = await this.findOne(id);

    const updatedGroup = await this.prisma.companyGroup.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log(
      'CompanyGroup',
      id,
      'UPDATE',
      oldGroup,
      updatedGroup,
    );

    return updatedGroup;
  }

  async remove(id: string) {
    if (!this.organizationScope.current().isGlobal) {
      throw new ForbiddenException(
        'Only a global administrator can delete a Company Group.',
      );
    }

    const group = await this.findOne(id);

    await this.auditService.log('CompanyGroup', id, 'DELETE', group, null);

    return this.prisma.companyGroup.delete({
      where: { id },
    });
  }
}
