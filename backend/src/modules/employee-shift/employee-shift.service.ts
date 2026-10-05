import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';

import { CreateEmployeeShiftDto } from './dto/create-employee-shift.dto';

@Injectable()
export class EmployeeShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateEmployeeShiftDto) {
    const employee = await this.employeeDomainScope.assertEmployeeInScope(
      dto.employeeId,
    );

    const shift = await this.prisma.shift.findFirst({
      where: {
        id: dto.shiftId,
        companyId: employee.companyId,
      },
    });

    if (!shift) {
      this.employeeDomainScope.notFound('Shift');
    }

    return this.prisma.employeeShift.create({
      data: {
        employeeId: dto.employeeId,
        shiftId: dto.shiftId,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.employeeShift.findMany({
      where: {
        employee: this.employeeDomainScope.employeeWhere(),
      },
      include: {
        employee: true,
        shift: true,
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.employeeShift.findFirst({
      where: {
        id,
        employee: this.employeeDomainScope.employeeWhere(),
      },
      include: {
        employee: true,
        shift: true,
      },
    });

    if (!record) {
      this.employeeDomainScope.notFound('Assignment');
    }

    return record;
  }
}
