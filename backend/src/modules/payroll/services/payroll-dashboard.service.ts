import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

import type { PayrollAccessContext } from '../payroll-access.types';
import { PayrollScopeService } from './payroll-scope.service';

@Injectable()
export class PayrollDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
  ) {}

  async getDashboard(context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const runs = await this.prisma.payrollRun.findMany({
      where: {
        companyId,
        statusEnum: {
          in: [
            PayrollRunStatus.CALCULATED,
            PayrollRunStatus.APPROVED,
            PayrollRunStatus.PAID,
          ],
        },
      },
      orderBy: [{ payrollYear: 'desc' }, { payrollMonth: 'desc' }],
      take: 12,
    });

    const approvalQueue = await this.prisma.payrollRun.findMany({
      where: {
        companyId,
        statusEnum: PayrollRunStatus.CALCULATED,
      },
      orderBy: { calculatedAt: 'asc' },
      take: 20,
    });

    const paidTotals = await this.prisma.payrollRun.aggregate({
      where: {
        companyId,
        statusEnum: PayrollRunStatus.PAID,
      },
      _sum: {
        totalEarnings: true,
        totalDeductions: true,
        totalNet: true,
      },
      _count: { id: true },
    });

    return {
      recentRuns: runs.map((run) => ({
        id: run.id,
        runNumber: run.runNumber,
        year: run.payrollYear,
        month: run.payrollMonth,
        status: this.scope.mapRunStatus(run.status, run.statusEnum),
        totals: {
          earnings: this.scope.decimalToString(run.totalEarnings),
          deductions: this.scope.decimalToString(run.totalDeductions),
          net: this.scope.decimalToString(run.totalNet),
        },
      })),
      approvalQueue: approvalQueue.map((run) => ({
        id: run.id,
        runNumber: run.runNumber,
        year: run.payrollYear,
        month: run.payrollMonth,
        calculatedAt: run.calculatedAt?.toISOString() ?? null,
      })),
      paidSummary: {
        runCount: paidTotals._count.id,
        totals: {
          earnings: this.scope.decimalToString(paidTotals._sum.totalEarnings),
          deductions: this.scope.decimalToString(
            paidTotals._sum.totalDeductions,
          ),
          net: this.scope.decimalToString(paidTotals._sum.totalNet),
        },
      },
    };
  }
}
