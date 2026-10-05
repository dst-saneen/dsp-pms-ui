import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { WorkforceErrorCode } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';

export interface SelfServiceContext {
  userId: string;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    employmentStatus: string;
    isActive: boolean;
    companyId: string;
    branchId: string;
    departmentId: string;
    designationId: string | null;
  };
  company: {
    id: string;
    companyName: string;
  };
  branch: {
    id: string;
    branchName: string;
    timezone: string | null;
  };
  department: {
    id: string;
    departmentName: string;
  };
  designation: {
    id: string;
    designationName: string;
  } | null;
  timezone: string | null;
}

@Injectable()
export class SelfServiceContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(actor: AuthenticatedUser): Promise<SelfServiceContext> {
    if (!actor.employeeId) {
      throw new BadRequestException({
        code: WorkforceErrorCode.EMPLOYEE_LINK_REQUIRED,
        message: 'Authenticated user is not linked to an employee',
      });
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: actor.employeeId },
      include: {
        company: {
          select: { id: true, companyName: true },
        },
        branch: {
          select: { id: true, branchName: true, timezone: true },
        },
        department: {
          select: { id: true, departmentName: true },
        },
        designation: {
          select: { id: true, designationName: true },
        },
      },
    });

    if (!employee || !employee.isActive) {
      throw new NotFoundException(
        'Linked employee was not found or is inactive',
      );
    }

    return {
      userId: actor.id,
      employeeId: employee.id,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        employmentStatus: employee.employmentStatus,
        isActive: employee.isActive,
        companyId: employee.companyId,
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        designationId: employee.designationId,
      },
      company: employee.company,
      branch: employee.branch,
      department: employee.department,
      designation: employee.designation,
      timezone: employee.branch.timezone,
    };
  }
}
