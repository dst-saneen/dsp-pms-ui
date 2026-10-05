import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateEmployeeAssignmentDto } from './dto/create-employee-assignment.dto';
import { UpdateEmployeeAssignmentDto } from './dto/update-employee-assignment.dto';

@Injectable()
export class EmployeeAssignmentService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeAssignmentDto) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: dto.employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const assignment = await this.prisma.employeeCompanyAssignment.create({
      data: {
        ...dto,
      },
    });

    await this.auditService.log(
      'EmployeeAssignment',
      assignment.id,
      'CREATE',
      null,
      assignment,
    );

    return assignment;
  }

  async findAll() {
    return this.prisma.employeeCompanyAssignment.findMany({
      include: {
        employee: true,
        company: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const assignment = await this.prisma.employeeCompanyAssignment.findUnique({
      where: { id },
      include: {
        employee: true,
        company: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  async update(id: string, dto: UpdateEmployeeAssignmentDto) {
    const oldAssignment = await this.findOne(id);

    const assignment = await this.prisma.employeeCompanyAssignment.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log(
      'EmployeeAssignment',
      id,
      'UPDATE',
      oldAssignment,
      assignment,
    );

    return assignment;
  }

  async deactivate(id: string) {
    const oldAssignment = await this.findOne(id);

    const assignment = await this.prisma.employeeCompanyAssignment.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    await this.auditService.log(
      'EmployeeAssignment',
      id,
      'DEACTIVATE',
      oldAssignment,
      assignment,
    );

    return assignment;
  }
}
