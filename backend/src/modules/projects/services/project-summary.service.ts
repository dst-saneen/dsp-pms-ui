import { Injectable } from '@nestjs/common';
import { Prisma, WorkLogStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { OfficeFinanceFeatureService } from '../../office-finance/services/office-finance-feature.service';
import { OfficeFinanceReportsService } from '../../office-finance/services/office-finance-reports.service';
import type { ProjectsActorContext } from '../types/project.types';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectsQueryService } from './projects-query.service';

@Injectable()
export class ProjectSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly query: ProjectsQueryService,
    private readonly financeFeature: OfficeFinanceFeatureService,
    private readonly financeReports: OfficeFinanceReportsService,
  ) {}

  async getSummary(projectId: string, actor: ProjectsActorContext) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    const [stageCounts, teamActive, taskCounts, documentCount] =
      await Promise.all([
        this.prisma.projectStage.groupBy({
          by: ['statusV2'],
          where: { projectId, companyId: project.companyId },
          _count: { _all: true },
        }),
        this.prisma.projectTeamMember.count({
          where: {
            projectId,
            companyId: project.companyId,
            statusV2: 'ACTIVE',
          },
        }),
        this.prisma.projectTask.groupBy({
          by: ['statusV2'],
          where: { projectId, companyId: project.companyId },
          _count: { _all: true },
        }),
        this.prisma.projectDocument.count({
          where: { projectId, companyId: project.companyId },
        }),
      ]);

    return {
      project: this.query.toProjectView(project, actor),
      stages: this.countMap(stageCounts),
      team: { activeMembers: teamActive },
      tasks: this.countMap(taskCounts),
      documents: { count: documentCount },
    };
  }

  async getTimeSummary(projectId: string, actor: ProjectsActorContext) {
    void actor;
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    const planned = await this.prisma.projectTask.aggregate({
      where: {
        projectId,
        companyId: project.companyId,
        statusV2: { not: 'CANCELLED' },
      },
      _sum: { plannedHours: true },
    });

    const approvedLines = await this.prisma.workLogLine.findMany({
      where: {
        companyId: project.companyId,
        taskId: { not: null },
        task: { projectId },
        workLogHeader: { statusV2: WorkLogStatus.APPROVED },
      },
      select: {
        hours: true,
        employeeId: true,
        taskId: true,
      },
    });

    let approvedHours = new Prisma.Decimal(0);
    const byEmployee = new Map<string, Prisma.Decimal>();
    const byTask = new Map<string, Prisma.Decimal>();

    for (const line of approvedLines) {
      approvedHours = approvedHours.add(line.hours);
      byEmployee.set(
        line.employeeId,
        (byEmployee.get(line.employeeId) ?? new Prisma.Decimal(0)).add(
          line.hours,
        ),
      );
      if (line.taskId) {
        byTask.set(
          line.taskId,
          (byTask.get(line.taskId) ?? new Prisma.Decimal(0)).add(line.hours),
        );
      }
    }

    return {
      projectId,
      plannedHours: (
        planned._sum.plannedHours ?? new Prisma.Decimal(0)
      ).toString(),
      approvedHours: approvedHours.toString(),
      byEmployee: [...byEmployee.entries()].map(([employeeId, hours]) => ({
        employeeId,
        hours: hours.toString(),
      })),
      byTask: [...byTask.entries()].map(([taskId, hours]) => ({
        taskId,
        hours: hours.toString(),
      })),
    };
  }

  async getFinanceSummary(projectId: string, actor: ProjectsActorContext) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    if (!(await this.financeFeature.isEnabledForCompany(project.companyId))) {
      return {
        projectId,
        enabled: false,
        currencyCode: project.currencyCode,
        expectedIncome: project.expectedIncome?.toString() ?? null,
        expenseBudget: project.expenseBudget?.toString() ?? null,
        approvedIncome: null,
        approvedExpenses: null,
        netOperationalCash: null,
        message:
          'Operational cash summary is unavailable until Office Finance is enabled.',
      };
    }

    const finance = await this.financeReports.projectFinanceSummary(projectId, {
      userId: actor.userId,
      permissions: actor.permissions,
      employeeId: actor.employeeId,
      activeCompanyId: project.companyId,
      activeBranchId: actor.branchId,
    });

    return {
      projectId: finance.projectId,
      enabled: true,
      currencyCode: project.currencyCode,
      expectedIncome: project.expectedIncome?.toString() ?? null,
      expenseBudget: project.expenseBudget?.toString() ?? null,
      approvedIncome: finance.totalIncome,
      approvedExpenses: finance.totalExpense,
      netOperationalCash: finance.net,
      asOf: finance.asOf,
      message: null,
    };
  }

  private countMap(
    rows: Array<{ statusV2: string | null; _count: { _all: number } }>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of rows) {
      const key = row.statusV2 ?? 'UNKNOWN';
      result[key] = row._count._all;
    }
    return result;
  }
}
