import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { OrganizationScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';

@Injectable()
export class DepartmentService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(dto: CreateDepartmentDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    await this.organizationScope.assertCurrentBranch(dto.branchId);
    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const branch = await this.prisma.branch.findUnique({
      where: {
        id: dto.branchId,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.companyId !== dto.companyId) {
      throw new NotFoundException('Branch not found');
    }

    const departmentCode = await this.numberSeries.next(
      'DEPARTMENT',
      dto.branchId,
      'DEP',
    );
    const department = await this.prisma.department.create({
      data: {
        ...dto,
        departmentCode,
      },
    });

    await this.auditService.log(
      'Department',
      department.id,
      'CREATE',
      null,
      department,
    );

    return department;
  }

  async findAll(branchId?: string, companyId?: string) {
    const scope = this.organizationScope.current();
    const scopedBranchId = this.organizationScope.branchIdOrUndefined();

    if (companyId) {
      await this.organizationScope.assertCurrentCompany(companyId);
    }

    if (branchId) {
      await this.organizationScope.assertCurrentBranch(branchId);
    }

    const include = {
      company: true,
      branch: true,
    } as const;

    // Branch-scoped users only see their active Branch.
    if (scopedBranchId) {
      return this.prisma.department.findMany({
        where: {
          branchId: scopedBranchId,
          ...(companyId ? { companyId } : {}),
        },
        include,
        orderBy: {
          departmentName: 'asc',
        },
      });
    }

    // Company Group owners/admins: list all Departments in the Group unless
    // company/branch filters are supplied. Do not hide other companies'
    // Departments because of workspace activeCompanyId.
    if (
      !scope.isGlobal &&
      scope.scopeLevel === 'COMPANY_GROUP' &&
      scope.activeCompanyGroupId
    ) {
      return this.prisma.department.findMany({
        where: {
          ...(companyId
            ? { companyId }
            : {
                company: {
                  companyGroupId: scope.activeCompanyGroupId,
                },
              }),
          ...(branchId ? { branchId } : {}),
        },
        include,
        orderBy: {
          departmentName: 'asc',
        },
      });
    }

    const scopedCompanyId =
      companyId ?? this.organizationScope.companyIdOrUndefined();

    return this.prisma.department.findMany({
      where: {
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include,
      orderBy: {
        departmentName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const scope = this.organizationScope.current();
    const scopedBranchId = this.organizationScope.branchIdOrUndefined();

    if (scopedBranchId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id,
          branchId: scopedBranchId,
        },
        include: {
          company: true,
          branch: true,
        },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      return department;
    }

    if (
      !scope.isGlobal &&
      scope.scopeLevel === 'COMPANY_GROUP' &&
      scope.activeCompanyGroupId
    ) {
      const department = await this.prisma.department.findFirst({
        where: {
          id,
          company: {
            companyGroupId: scope.activeCompanyGroupId,
          },
        },
        include: {
          company: true,
          branch: true,
        },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      return department;
    }

    const companyId = this.organizationScope.companyIdOrUndefined();
    const department = await this.prisma.department.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const oldDepartment = await this.findOne(id);

    const updatedDepartment = await this.prisma.department.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log(
      'Department',
      id,
      'UPDATE',
      oldDepartment,
      updatedDepartment,
    );

    return updatedDepartment;
  }

  async remove(id: string) {
    const department = await this.findOne(id);

    await this.auditService.log('Department', id, 'DELETE', department, null);

    return this.prisma.department.delete({
      where: { id },
    });
  }
}
