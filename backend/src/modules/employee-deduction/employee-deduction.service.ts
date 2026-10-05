import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateEmployeeDeductionDto } from './dto/create-employee-deduction.dto';
import { UpdateEmployeeDeductionDto } from './dto/update-employee-deduction.dto';

@Injectable()
export class EmployeeDeductionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDeductionDto) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: dto.employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.endMonth && new Date(dto.endMonth) < new Date(dto.startMonth)) {
      throw new ConflictException(
        'End month cannot be earlier than start month',
      );
    }

    const existing = await this.prisma.employeeDeduction.findFirst({
      where: {
        employeeId: dto.employeeId,
        deductionCode: dto.deductionCode,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Deduction already exists for employee');
    }

    return this.prisma.employeeDeduction.create({
      data: {
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        deductionCode: dto.deductionCode?.trim().toUpperCase(),
        deductionName: dto.deductionName.trim(),
        monthlyAmount: dto.monthlyAmount,
        startMonth: new Date(dto.startMonth),
        endMonth: dto.endMonth ? new Date(dto.endMonth) : null,
        remarks: dto.remarks,
      },

      include: {
        employee: true,
        company: true,
      },
    });
  }

  async findAll() {
    return this.prisma.employeeDeduction.findMany({
      where: {
        isActive: true,
      },

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
    const deduction = await this.prisma.employeeDeduction.findUnique({
      where: { id },

      include: {
        employee: true,
        company: true,
      },
    });

    if (!deduction || !deduction.isActive) {
      throw new NotFoundException('Deduction not found');
    }

    return deduction;
  }

  async update(id: string, dto: UpdateEmployeeDeductionDto) {
    await this.findOne(id);

    if (
      dto.startMonth &&
      dto.endMonth &&
      new Date(dto.endMonth) < new Date(dto.startMonth)
    ) {
      throw new ConflictException(
        'End month cannot be earlier than start month',
      );
    }

    return this.prisma.employeeDeduction.update({
      where: { id },

      data: {
        deductionCode: dto.deductionCode
          ? dto.deductionCode.trim().toUpperCase()
          : undefined,

        deductionName: dto.deductionName ? dto.deductionName.trim() : undefined,

        monthlyAmount: dto.monthlyAmount,

        startMonth: dto.startMonth ? new Date(dto.startMonth) : undefined,

        endMonth: dto.endMonth ? new Date(dto.endMonth) : undefined,

        remarks: dto.remarks,
      },

      include: {
        employee: true,
        company: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employeeDeduction.update({
      where: { id },

      data: {
        isActive: false,
      },
    });
  }
}
