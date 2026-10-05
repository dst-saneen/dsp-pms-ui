import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunDto } from './dto/update-payroll-run.dto';

@Injectable()
export class PayrollRunService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: {
        companyId: dto.companyId,
        payrollYear: dto.payrollYear,
        payrollMonth: dto.payrollMonth,
      },
    });

    if (existing) {
      throw new ConflictException('Payroll already exists for this month');
    }

    const payrollRun = await this.prisma.payrollRun.create({
      data: {
        companyId: dto.companyId,
        payrollYear: dto.payrollYear,
        payrollMonth: dto.payrollMonth,
        remarks: dto.remarks,
        status: 'DRAFT',
      },
    });

    const payrollDate = new Date(
      Date.UTC(dto.payrollYear, dto.payrollMonth - 1, 1),
    );

    const salaries = await this.prisma.employeeSalary.findMany({
      where: {
        companyId: dto.companyId,
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
    });

    for (const salary of salaries) {
      const grossEarnings = salary.lines
        .filter((line) => line.salaryComponent.componentType === 'EARNING')
        .reduce((sum, line) => sum + Number(line.amount), 0);

      const taxProfile = await this.prisma.employeeTaxProfile.findFirst({
        where: {
          employeeId: salary.employeeId,
          isActive: true,
        },
      });

      const taxAmount = Number(taxProfile?.monthlyTaxAmount ?? 0);

      const deductions = await this.prisma.employeeDeduction.findMany({
        where: {
          employeeId: salary.employeeId,
          isActive: true,

          startMonth: {
            lte: payrollDate,
          },

          OR: [
            {
              endMonth: null,
            },
            {
              endMonth: {
                gte: payrollDate,
              },
            },
          ],
        },
      });

      const deductionAmount = deductions.reduce(
        (sum, item) => sum + Number(item.monthlyAmount),
        0,
      );

      const netSalary = grossEarnings - taxAmount - deductionAmount;

      await this.prisma.payrollRunEmployee.create({
        data: {
          companyId: dto.companyId,
          payrollRunId: payrollRun.id,
          branchId: salary.employee.branchId,
          employeeId: salary.employeeId,

          payrollYear: dto.payrollYear,
          payrollMonth: dto.payrollMonth,

          grossEarnings,
          taxAmount,
          deductionAmount,
          netSalary,
        },
      });
    }

    return this.prisma.payrollRun.update({
      where: {
        id: payrollRun.id,
      },

      data: {
        status: 'PROCESSED',
        processedDate: new Date(),
      },

      include: {
        employees: {
          include: {
            employee: true,
          },
        },

        company: true,
      },
    });
  }

  async findAll() {
    return this.prisma.payrollRun.findMany({
      include: {
        company: true,

        employees: {
          include: {
            employee: true,
          },
        },
      },

      orderBy: [
        {
          payrollYear: 'desc',
        },
        {
          payrollMonth: 'desc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const payroll = await this.prisma.payrollRun.findUnique({
      where: {
        id,
      },

      include: {
        company: true,

        employees: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll run not found');
    }

    return payroll;
  }

  async update(id: string, dto: UpdatePayrollRunDto) {
    throw new ConflictException(
      'Processed payroll cannot be edited. Create a new payroll run instead.',
    );
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.payrollRunEmployee.deleteMany({
      where: {
        payrollRunId: id,
      },
    });

    return this.prisma.payrollRun.delete({
      where: {
        id,
      },
    });
  }
}
