import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';

import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { Prisma } from '@prisma/client';
import { LeavePolicyFilterDto } from './dto/leave-policy-filter.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';

@Injectable()
export class LeavePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateLeavePolicyDto) {
    this.assertAnnualEntitlement(dto.annualEntitlement);
    const scope = this.resolveScopeDimensions(dto);
    await this.validateRelations(scope);
    const existing = await this.prisma.leavePolicy.findFirst({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        designationId: scope.designationId,
        leaveTypeId: scope.leaveTypeId,
        isActive: true,
      },
    });

    if (existing) {
      throw new BadRequestException('Leave policy already exists');
    }

    return this.prisma.leavePolicy.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        designationId: scope.designationId,
        leaveTypeId: scope.leaveTypeId,
        annualEntitlement: dto.annualEntitlement,
        carryForwardLimit: dto.carryForwardLimit,
        maxConsecutiveDays: dto.maxConsecutiveDays,
        allowNegativeBalance: dto.allowNegativeBalance,
      },
    });
  }

  async findAll(filters: LeavePolicyFilterDto) {
    const where: Prisma.LeavePolicyWhereInput = {
      isActive: true,
      ...this.employeeDomainScope.leavePolicyWhere(),
    };

    if (filters.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(filters.companyId);
      where.companyId = filters.companyId;
    }

    if (filters.branchId) {
      await this.employeeDomainScope.assertBranchInScope(
        filters.branchId,
        filters.companyId,
      );
      where.branchId = filters.branchId;
    }

    if (filters.departmentId) {
      await this.employeeDomainScope.assertDepartmentInScope(
        filters.departmentId,
        filters.companyId,
        filters.branchId,
      );
      where.departmentId = filters.departmentId;
    }

    if (filters.designationId) {
      await this.employeeDomainScope.assertDesignationInScope(
        filters.designationId,
        filters.companyId,
      );
      where.designationId = filters.designationId;
    }

    if (filters.leaveTypeId) {
      where.leaveTypeId = filters.leaveTypeId;
    }

    return this.prisma.leavePolicy.findMany({
      where,
      include: {
        company: true,
        branch: true,
        department: true,
        designation: true,
        leaveType: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.leavePolicy.findFirst({
      where: {
        id,
        isActive: true,
        ...this.employeeDomainScope.leavePolicyWhere(),
      },
      include: {
        company: true,
        branch: true,
        department: true,
        designation: true,
        leaveType: true,
      },
    });

    if (!policy) {
      throw new NotFoundException('Leave policy not found');
    }

    return policy;
  }

  async update(id: string, dto: UpdateLeavePolicyDto) {
    if (dto.annualEntitlement !== undefined) {
      this.assertAnnualEntitlement(dto.annualEntitlement);
    }
    const policy = await this.findOne(id);
    const scope = this.resolveScopeDimensions({
      companyId: dto.companyId ?? policy.companyId,
      branchId: dto.branchId !== undefined ? dto.branchId : policy.branchId,
      departmentId:
        dto.departmentId !== undefined
          ? dto.departmentId
          : (policy.departmentId ?? undefined),
      designationId:
        dto.designationId !== undefined
          ? dto.designationId
          : (policy.designationId ?? undefined),
      leaveTypeId: dto.leaveTypeId ?? policy.leaveTypeId,
    });
    await this.validateRelations(scope);

    return this.prisma.leavePolicy.update({
      where: { id },
      data: {
        ...dto,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        designationId: scope.designationId,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.leavePolicy.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  private assertAnnualEntitlement(annualEntitlement: number) {
    if (
      !Number.isFinite(annualEntitlement) ||
      annualEntitlement <= 0 ||
      annualEntitlement > 400
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message:
          'Leave policy entitlement must be greater than zero and at most 400 days',
      });
    }
  }

  private resolveScopeDimensions(dto: {
    companyId: string;
    branchId?: string | null;
    departmentId?: string | null;
    designationId?: string | null;
    leaveTypeId: string;
  }) {
    const branchId = dto.branchId ?? null;
    if (branchId == null) {
      if (dto.departmentId || dto.designationId) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message:
            'Company-default leave policies cannot set department or designation; choose a branch first',
        });
      }
      return {
        companyId: dto.companyId,
        branchId: null,
        departmentId: null,
        designationId: null,
        leaveTypeId: dto.leaveTypeId,
      };
    }

    return {
      companyId: dto.companyId,
      branchId,
      departmentId: dto.departmentId ?? null,
      designationId: dto.designationId ?? null,
      leaveTypeId: dto.leaveTypeId,
    };
  }

  private async validateRelations(dto: {
    companyId: string;
    branchId: string | null;
    departmentId: string | null;
    designationId: string | null;
    leaveTypeId: string;
  }) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);

    if (dto.branchId) {
      await this.employeeDomainScope.assertBranchInScope(
        dto.branchId,
        dto.companyId,
      );
    }

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id: dto.leaveTypeId,
        companyId: dto.companyId,
        isActive: true,
        ...this.employeeDomainScope.leaveTypeWhere(),
      },
      select: { id: true },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    if (dto.departmentId) {
      if (!dto.branchId) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Department requires a branch on the leave policy',
        });
      }
      await this.employeeDomainScope.assertDepartmentInScope(
        dto.departmentId,
        dto.companyId,
        dto.branchId,
      );
    }

    if (dto.designationId) {
      if (!dto.branchId) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Designation requires a branch on the leave policy',
        });
      }
      await this.employeeDomainScope.assertDesignationInScope(
        dto.designationId,
        dto.companyId,
      );
    }
  }
}
