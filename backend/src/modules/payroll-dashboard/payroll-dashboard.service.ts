import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PayrollDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanySummary(companyId: string) {
    const payrolls = await this.prisma.payrollRunEmployee.findMany({
      where: {
        payrollRun: {
          companyId,
        },
      },

      include: {
        payrollRun: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!payrolls.length) {
      throw new NotFoundException('No payroll data found');
    }

    const summary = payrolls.reduce(
      (acc, item) => {
        acc.employeeCount++;

        acc.grossEarnings += Number(item.grossEarnings);

        acc.taxAmount += Number(item.taxAmount);

        acc.deductionAmount += Number(item.deductionAmount);

        acc.netSalary += Number(item.netSalary);

        return acc;
      },
      {
        employeeCount: 0,
        grossEarnings: 0,
        taxAmount: 0,
        deductionAmount: 0,
        netSalary: 0,
      },
    );

    return {
      company: payrolls[0].payrollRun.company.companyName,

      ...summary,
    };
  }

  async getMonthlySummary(year: number, month: number) {
    const payrolls = await this.prisma.payrollRunEmployee.findMany({
      where: {
        payrollYear: year,
        payrollMonth: month,
      },

      include: {
        payrollRun: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!payrolls.length) {
      throw new NotFoundException('No payroll found for this period');
    }

    const summary = payrolls.reduce(
      (acc, item) => {
        acc.employeeCount++;

        acc.grossEarnings += Number(item.grossEarnings);
        acc.taxAmount += Number(item.taxAmount);
        acc.deductionAmount += Number(item.deductionAmount);
        acc.netSalary += Number(item.netSalary);

        return acc;
      },
      {
        employeeCount: 0,
        grossEarnings: 0,
        taxAmount: 0,
        deductionAmount: 0,
        netSalary: 0,
      },
    );

    return {
      company: payrolls[0].payrollRun.company.companyName,

      payrollYear: year,
      payrollMonth: month,

      ...summary,
    };
  }

  async getEmployeeHistory(employeeId: string) {
    const history = await this.prisma.payrollRunEmployee.findMany({
      where: {
        employeeId,
      },

      include: {
        payrollRun: {
          include: {
            company: true,
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

    if (!history.length) {
      throw new NotFoundException('Payroll history not found');
    }

    return history.map((item) => ({
      company: item.payrollRun.company.companyName,

      payrollYear: item.payrollYear,
      payrollMonth: item.payrollMonth,

      grossEarnings: Number(item.grossEarnings),
      taxAmount: Number(item.taxAmount),
      deductionAmount: Number(item.deductionAmount),
      netSalary: Number(item.netSalary),
    }));
  }
}
