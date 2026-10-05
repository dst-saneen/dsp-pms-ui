import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateEmployeeSalaryDto } from './dto/create-employee-salary.dto';
import { UpdateEmployeeSalaryDto } from './dto/update-employee-salary.dto';

@Injectable()
export class EmployeeSalaryService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateEmployeeSalaryDto) {
    if (!dto.lines.length) {
      throw new ConflictException('At least one salary component is required');
    }

    const componentIds = dto.lines.map((x) => x.salaryComponentId);

    if (componentIds.length !== new Set(componentIds).size) {
      throw new ConflictException(
        'Duplicate salary components are not allowed',
      );
    }

    const existing = await this.prisma.employeeSalary.findFirst({
      where: {
        employeeId: dto.employeeId,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Employee already has an active salary structure',
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: {
        id: dto.employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const salaryComponents = await this.prisma.salaryComponent.findMany({
      where: {
        id: {
          in: componentIds,
        },
        isActive: true,
      },
    });

    if (salaryComponents.length !== componentIds.length) {
      throw new NotFoundException('One or more salary components not found');
    }

    return this.prisma.employeeSalary
      .create({
        data: {
          companyId: dto.companyId,
          employeeId: dto.employeeId,
          effectiveFrom: new Date(dto.effectiveFrom),
          remarks: dto.remarks,
        },
      })
      .then(async (created) => {
        await this.prisma.employeeSalaryLine.createMany({
          data: dto.lines.map((line) => ({
            companyId: dto.companyId,
            employeeSalaryId: created.id,
            salaryComponentId: line.salaryComponentId,
            amount: line.amount,
          })),
        });
        return this.prisma.employeeSalary.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            company: true,
            employee: true,
            lines: {
              include: {
                salaryComponent: true,
              },
            },
          },
        });
      });
  }

  async findAll() {
    return this.prisma.employeeSalary.findMany({
      where: {
        isActive: true,
      },

      include: {
        employee: true,

        lines: {
          include: {
            salaryComponent: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const salary = await this.prisma.employeeSalary.findUnique({
      where: { id },

      include: {
        employee: true,

        lines: {
          include: {
            salaryComponent: true,
          },
        },
      },
    });

    if (!salary || !salary.isActive) {
      throw new NotFoundException('Salary structure not found');
    }

    return salary;
  }

  async update(id: string, updateEmployeeSalaryDto: UpdateEmployeeSalaryDto) {
    throw new ConflictException(
      'Salary structure cannot be edited. Create a new salary structure instead.',
    );
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employeeSalary.update({
      where: { id },

      data: {
        isActive: false,
        effectiveTo: new Date(),
      },
    });
  }
}
