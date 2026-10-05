import { Injectable } from '@nestjs/common';
import { EmployeeAssetStatus, Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { AuditService } from '../audit/audit.service';
import { ASSET_ERROR_CODES } from '../asset-domain/policies/asset-error-codes';

import { CreateEmployeeAssetDto } from './dto/create-employee-asset.dto';
import { AssetReturnOutcome, ReturnAssetDto } from './dto/return-asset.dto';

const TERMINAL_ASSIGNMENT_STATUSES = new Set(['RETURNED', 'LOST', 'DAMAGED']);
const TERMINAL_EMPLOYMENT_STATUSES = new Set(['TERMINATED', 'RESIGNED']);

const ASSIGNMENT_INCLUDE = {
  employee: {
    include: {
      company: true,
      branch: true,
      department: true,
      designation: true,
    },
  },
  asset: {
    include: {
      assetType: {
        include: {
          assetCategory: true,
        },
      },
    },
  },
} satisfies Prisma.EmployeeAssetInclude;

@Injectable()
export class EmployeeAssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeAssetDto) {
    const employee = await this.scope.assertEmployeeInScope(dto.employeeId);
    this.assertEmployeeEligibleForAsset(employee);

    const asset = await this.prisma.asset.findFirst({
      where: {
        id: dto.assetId,
        ...this.scope.assetWhere(),
      },
    });

    if (!asset) {
      throw new DomainNotFoundException('ASSET_NOT_FOUND', 'Asset not found');
    }

    if (employee.companyId !== asset.companyId) {
      throw new DomainNotFoundException('ASSET_NOT_FOUND', 'Asset not found');
    }

    if (
      employee.branchId &&
      asset.branchId &&
      employee.branchId !== asset.branchId
    ) {
      throw new DomainNotFoundException('ASSET_NOT_FOUND', 'Asset not found');
    }

    if (!asset.isActive) {
      throw new DomainConflictException(
        'ASSET_NOT_AVAILABLE',
        'Asset is not active',
      );
    }

    if (asset.status !== 'AVAILABLE') {
      throw new DomainConflictException(
        'ASSET_NOT_AVAILABLE',
        'Asset is not available for assignment',
      );
    }

    const assignedById = await this.resolveActorEmployeeId();

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.asset.updateMany({
          where: {
            id: dto.assetId,
            status: 'AVAILABLE',
            isActive: true,
          },
          data: {
            status: 'ASSIGNED',
          },
        });

        if (claimed.count !== 1) {
          throw new DomainConflictException(
            'ASSET_ALREADY_ASSIGNED',
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

        const created = await tx.employeeAsset.create({
          data: {
            companyId: employee.companyId,
            employeeId: dto.employeeId,
            assetId: dto.assetId,
            assignedDate: new Date(dto.assignedDate),
            assignedById: assignedById ?? null,
            remarks: dto.remarks?.trim(),
            status: 'ASSIGNED',
            custodyStatus: EmployeeAssetStatus.ASSIGNED,
            branchIdAtAssignment,
            departmentIdAtAssignment,
          },
        });

        const result = await tx.employeeAsset.findUniqueOrThrow({
          where: { id: created.id },
          include: ASSIGNMENT_INCLUDE,
        });

        await this.auditService.log(
          'EmployeeAsset',
          result.id,
          'CREATE',
          null,
          this.auditSnapshot(result),
          { tx },
        );

        return result;
      });

      return assignment;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new DomainConflictException(
          'ASSET_ALREADY_ASSIGNED',
          'Asset is already assigned to an employee',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.prisma.employeeAsset.findMany({
      where: this.scope.employeeAssetWhere(),
      include: ASSIGNMENT_INCLUDE,
      orderBy: {
        assignedDate: 'desc',
      },
    });
  }

  async findByEmployee(employeeId: string) {
    await this.scope.assertEmployeeInScope(employeeId);

    return this.prisma.employeeAsset.findMany({
      where: {
        employeeId,
        ...this.scope.employeeAssetWhere(),
      },
      include: {
        asset: {
          include: {
            assetType: {
              include: {
                assetCategory: true,
              },
            },
          },
        },
      },
      orderBy: {
        assignedDate: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.findScopedAssignment(id);
  }

  async findByAsset(assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        ...this.scope.assetWhere(),
      },
      select: { id: true },
    });

    if (!asset) {
      throw new DomainNotFoundException('ASSET_NOT_FOUND', 'Asset not found');
    }

    return this.prisma.employeeAsset.findMany({
      where: {
        assetId,
        ...this.scope.employeeAssetWhere(),
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: {
        assignedDate: 'desc',
      },
    });
  }

  async returnAsset(id: string, dto: ReturnAssetDto) {
    const assignment = await this.findScopedAssignment(id);

    if (TERMINAL_ASSIGNMENT_STATUSES.has(assignment.status)) {
      throw new DomainConflictException(
        'ASSET_ALREADY_RETURNED',
        'Asset assignment has already been closed',
      );
    }

    const returnedById = await this.resolveActorEmployeeId();
    const returnedDate = new Date(dto.returnedDate);
    const assetStatus = this.resolveAssetStatusForOutcome(dto.outcome);

    const result = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.employeeAsset.updateMany({
        where: {
          id,
          status: 'ASSIGNED',
          returnedDate: null,
        },
        data: {
          returnedDate,
          returnedById,
          remarks: dto.remarks?.trim(),
          status: dto.outcome,
        },
      });

      if (closed.count !== 1) {
        throw new DomainConflictException(
          'ASSET_ALREADY_RETURNED',
          'Asset assignment has already been closed',
        );
      }

      await tx.asset.update({
        where: { id: assignment.assetId },
        data: {
          status: assetStatus,
        },
      });

      const updated = await tx.employeeAsset.findUniqueOrThrow({
        where: { id },
      });

      await this.auditService.log(
        'EmployeeAsset',
        id,
        'RETURN',
        this.auditSnapshot(assignment),
        this.auditSnapshot(updated),
        { tx },
      );

      return updated;
    });

    return result;
  }

  private async findScopedAssignment(id: string) {
    const assignment = await this.prisma.employeeAsset.findFirst({
      where: {
        id,
        ...this.scope.employeeAssetWhere(),
      },
      include: ASSIGNMENT_INCLUDE,
    });

    if (!assignment) {
      throw new DomainNotFoundException(
        'ASSET_ASSIGNMENT_NOT_FOUND',
        'Assignment not found',
      );
    }

    return assignment;
  }

  private assertEmployeeEligibleForAsset(employee: {
    isActive: boolean;
    employmentStatus: string;
  }) {
    if (
      !employee.isActive ||
      TERMINAL_EMPLOYMENT_STATUSES.has(employee.employmentStatus)
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET,
        'Employee is inactive or no longer eligible for asset assignment',
      );
    }
  }

  private async resolveActorEmployeeId(): Promise<string | undefined> {
    const { userId } = getRequestActor();

    if (!userId) {
      return undefined;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    return user?.employeeId ?? undefined;
  }

  private resolveAssetStatusForOutcome(outcome: AssetReturnOutcome): string {
    switch (outcome) {
      case AssetReturnOutcome.RETURNED:
        return 'AVAILABLE';
      case AssetReturnOutcome.LOST:
        return 'LOST';
      case AssetReturnOutcome.DAMAGED:
        return 'REPAIR';
      default:
        return 'AVAILABLE';
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private auditSnapshot(assignment: {
    id: string;
    employeeId: string;
    assetId: string;
    status: string;
    returnedDate?: Date | null;
  }) {
    return {
      id: assignment.id,
      employeeId: assignment.employeeId,
      assetId: assignment.assetId,
      status: assignment.status,
      returnedDate: assignment.returnedDate ?? null,
    };
  }
}
