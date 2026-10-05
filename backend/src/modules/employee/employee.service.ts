import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EmployeeCreationSource, Prisma } from '@prisma/client';
import { SearchEmployeeDto } from './dto/search-employee.dto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { OrganizationScopeService } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { SessionService } from '../auth/session.service';
import { UserStatus } from '@prisma/client';
import { NumberSeriesService } from '../number-series';
import { AssetClearanceService } from '../asset-domain/asset-clearance.service';
import { SortOrder } from '../../common/enums';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly sessionService: SessionService,
    private readonly numberSeries: NumberSeriesService,
    private readonly assetClearance: AssetClearanceService,
  ) {}

  private async validateCompany(companyId: string) {
    return this.employeeDomainScope.assertCompanyInScope(companyId);
  }

  private async validateBranch(branchId: string) {
    await this.organizationScope.assertCurrentBranch(branchId);
    const branch = await this.prisma.branch.findUnique({
      where: {
        id: branchId,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async validateDepartment(departmentId: string) {
    return this.employeeDomainScope.assertDepartmentInScope(departmentId);
  }

  private async validateDesignation(
    designationId: string | undefined,
    companyId: string,
  ) {
    if (!designationId) {
      return null;
    }

    return this.employeeDomainScope.assertDesignationInScope(
      designationId,
      companyId,
    );
  }

  private async validateManager(
    managerId: string | undefined,
    companyId: string,
  ) {
    if (!managerId) {
      return null;
    }

    const manager = await this.prisma.employee.findFirst({
      where: {
        id: managerId,
        companyId,
        ...this.employeeDomainScope.employeeWhere(),
      },
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (!manager.isActive) {
      throw new BadRequestException('Selected manager is inactive');
    }

    return manager;
  }

  private async validateOrganizationHierarchy(
    companyId: string,
    branchId: string,
    departmentId: string,
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: {
        id: branchId,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.companyId !== companyId) {
      throw new NotFoundException('Branch not found');
    }

    const department = await this.prisma.department.findUnique({
      where: {
        id: departmentId,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.branchId !== branchId) {
      throw new NotFoundException('Department not found');
    }
  }

  async create(dto: CreateEmployeeDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    await this.organizationScope.assertCurrentBranch(dto.branchId);
    await this.validateCompany(dto.companyId);

    await this.validateBranch(dto.branchId);

    await this.validateDepartment(dto.departmentId);

    await this.validateDesignation(dto.designationId, dto.companyId);

    await this.validateManager(dto.managerId, dto.companyId);

    await this.validateOrganizationHierarchy(
      dto.companyId,
      dto.branchId,
      dto.departmentId,
    );

    const employeeCode = await this.numberSeries.next(
      'EMPLOYEE',
      'GLOBAL',
      'EMP',
    );

    const { creationReason, externalReference, ...employeeData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          ...employeeData,
          joiningDate: employeeData.joiningDate
            ? new Date(employeeData.joiningDate)
            : undefined,
          employeeCode,
          creationSource: EmployeeCreationSource.MANUAL,
          employmentStatus: employeeData.employmentStatus ?? 'ACTIVE',
        },
      });

      await this.auditService.log(
        'Employee',
        employee.id,
        'CREATE',
        null,
        {
          id: employee.id,
          employeeCode: employee.employeeCode,
          creationSource: employee.creationSource,
          creationReason,
          externalReference,
        },
        { tx },
      );

      return employee;
    });
  }

  async findAll(query: SearchEmployeeDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...this.employeeDomainScope.employeeWhere(),
    };
    if (query.search) {
      where.OR = [
        {
          employeeCode: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          mobile: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.companyId) {
      await this.organizationScope.assertCurrentCompany(query.companyId);
      where.companyId = query.companyId;
    }

    if (query.branchId) {
      await this.organizationScope.assertCurrentBranch(query.branchId);
      where.branchId = query.branchId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.designationId) {
      where.designationId = query.designationId;
    }

    if (query.employmentStatus) {
      where.employmentStatus = query.employmentStatus;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = this.resolveEmployeeSortBy(query.sortBy);
    const sortOrder =
      query.sortOrder === SortOrder.DESC
        ? 'desc'
        : query.sortOrder === SortOrder.ASC
          ? 'asc'
          : sortBy === 'firstName'
            ? 'asc'
            : 'desc';

    const include = {
      company: true,
      branch: true,
      department: true,
      designation: true,
      manager: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
        },
      },
      user: {
        select: {
          id: true,
          status: true,
          username: true,
        },
      },
    } as const;

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private resolveEmployeeSortBy(sortBy?: string): string {
    const allowed = new Set([
      'firstName',
      'lastName',
      'employeeCode',
      'employmentStatus',
      'joiningDate',
      'createdAt',
      'updatedAt',
    ]);
    if (sortBy && allowed.has(sortBy)) {
      return sortBy;
    }
    return 'firstName';
  }

  async summary() {
    const organizationWhere = this.employeeDomainScope.employeeWhere();
    const [active, probation, notice, terminated] = await Promise.all([
      this.prisma.employee.count({
        where: {
          ...organizationWhere,
          employmentStatus: 'ACTIVE',
        },
      }),

      this.prisma.employee.count({
        where: {
          ...organizationWhere,
          employmentStatus: 'PROBATION',
        },
      }),

      this.prisma.employee.count({
        where: {
          ...organizationWhere,
          employmentStatus: 'NOTICE',
        },
      }),

      this.prisma.employee.count({
        where: {
          ...organizationWhere,
          employmentStatus: 'TERMINATED',
        },
      }),
    ]);

    return [
      {
        key: 'active',
        label: 'Active Employees',
        value: active,
      },
      {
        key: 'probation',
        label: 'On Probation',
        value: probation,
      },
      {
        key: 'notice',
        label: 'Notice Period',
        value: notice,
      },
      {
        key: 'terminated',
        label: 'Terminated',
        value: terminated,
      },
    ];
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.employeeWhere(),
      },
      include: {
        company: true,
        branch: true,
        department: true,
        designation: true,

        manager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        user: {
          select: {
            id: true,
            status: true,
            username: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const oldEmployee = await this.findOne(id);
    const companyId = dto.companyId ?? oldEmployee.companyId;
    const branchId = dto.branchId ?? oldEmployee.branchId;
    const departmentId = dto.departmentId ?? oldEmployee.departmentId;

    // Prevent self-manager assignment
    if (dto.managerId && dto.managerId === id) {
      throw new BadRequestException('Employee cannot be their own manager');
    }

    // Validate Company
    if (dto.companyId) {
      await this.validateCompany(dto.companyId);
    }

    // Validate Branch
    if (dto.branchId) {
      await this.validateBranch(dto.branchId);
    }

    // Validate Department
    if (dto.departmentId) {
      await this.validateDepartment(dto.departmentId);
    }

    // Validate Designation
    await this.validateDesignation(
      dto.designationId ?? oldEmployee.designationId ?? undefined,
      companyId,
    );

    // Validate Manager
    await this.validateManager(
      dto.managerId ?? oldEmployee.managerId ?? undefined,
      companyId,
    );

    // Validate organization hierarchy
    await this.validateOrganizationHierarchy(companyId, branchId, departmentId);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...dto,
          joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        },
      });

      await this.auditService.log(
        'Employee',
        id,
        'UPDATE',
        oldEmployee,
        employee,
        { tx },
      );

      return employee;
    });
  }

  async deactivate(id: string) {
    const oldEmployee = await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assetClearance.assertResolved(id, tx);
      const employee = await tx.employee.update({
        where: { id },
        data: {
          isActive: false,
          employmentStatus: 'TERMINATED',
        },
      });

      const linkedUser = await tx.user.findUnique({
        where: { employeeId: id },
        select: { id: true },
      });
      let sessionIds: string[] = [];

      if (linkedUser) {
        await tx.user.update({
          where: { id: linkedUser.id },
          data: {
            status: UserStatus.DISABLED,
            securityVersion: { increment: 1 },
          },
        });
        sessionIds = await this.sessionService.revokeAllInTransaction(
          tx,
          linkedUser.id,
          'EMPLOYEE_DEACTIVATED',
        );
      }

      await this.auditService.log(
        'Employee',
        id,
        'DEACTIVATE',
        oldEmployee,
        employee,
        { tx },
      );

      return { employee, sessionIds };
    });

    await this.sessionService.invalidateSessionIds(result.sessionIds);

    return result.employee;
  }
}
