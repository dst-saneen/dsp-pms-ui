import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { AssignResourceDto } from './dto/assign-resource.dto';
import { RevokeResourceDto } from './dto/revoke-resource.dto';

@Injectable()
export class EmployeeResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(dto: AssignResourceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        companyId: dto.companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const resource = await this.prisma.resource.findFirst({
      where: {
        id: dto.resourceId,
        companyId: dto.companyId,
        isActive: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    const existing = await this.prisma.employeeResource.findFirst({
      where: {
        employeeId: dto.employeeId,
        resourceId: dto.resourceId,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Resource already assigned');
    }

    return this.prisma.employeeResource.create({
      data: {
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        resourceId: dto.resourceId,
        assignedDate: new Date(dto.assignedDate),
        remarks: dto.remarks,
      },
      include: {
        employee: true,
        resource: {
          include: {
            resourceType: true,
          },
        },
      },
    });
  }

  async revoke(assignmentId: string, dto: RevokeResourceDto) {
    const assignment = await this.prisma.employeeResource.findUnique({
      where: {
        id: assignmentId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return this.prisma.employeeResource.update({
      where: {
        id: assignmentId,
      },
      data: {
        revokedDate: new Date(dto.revokedDate),
        remarks: dto.remarks,
        isActive: false,
      },
    });
  }

  async getEmployeeResources(employeeId: string) {
    return this.prisma.employeeResource.findMany({
      where: {
        employeeId,
      },
      include: {
        resource: {
          include: {
            resourceType: true,
          },
        },
      },
      orderBy: {
        assignedDate: 'desc',
      },
    });
  }

  async getActiveAssignments() {
    return this.prisma.employeeResource.findMany({
      where: {
        isActive: true,
      },
      include: {
        employee: true,
        resource: {
          include: {
            resourceType: true,
          },
        },
      },
      orderBy: {
        assignedDate: 'desc',
      },
    });
  }
}
