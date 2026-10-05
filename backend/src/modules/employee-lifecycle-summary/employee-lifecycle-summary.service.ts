import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

const ACTIVE_ONBOARDING_STATUSES: TaskStatus[] = ['IN_PROGRESS'];
const PENDING_TASK_STATUSES: TaskStatus[] = [
  'NOT_STARTED',
  'PENDING',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'OVERDUE',
];

@Injectable()
export class EmployeeLifecycleSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
  ) {}

  async getActiveOnboardingCount() {
    return this.prisma.employeeOnboarding.count({
      where: {
        ...this.scope.onboardingWhere(),
        status: { in: ACTIVE_ONBOARDING_STATUSES },
      },
    });
  }

  async getPendingOnboardingTaskCount() {
    return this.prisma.employeeOnboardingTask.count({
      where: {
        ...this.scope.onboardingTaskWhere(),
        status: { in: PENDING_TASK_STATUSES },
      },
    });
  }

  async getEmployeeOnboardingProgress(employeeId: string) {
    await this.scope.assertEmployeeInScope(employeeId);

    const onboarding = await this.prisma.employeeOnboarding.findFirst({
      where: {
        employeeId,
        ...this.scope.onboardingWhere(),
        status: { in: ACTIVE_ONBOARDING_STATUSES },
      },
      select: {
        id: true,
        status: true,
        progress: true,
        totalTasks: true,
        completedTasks: true,
        startDate: true,
        completedDate: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    if (!onboarding) {
      return null;
    }

    return {
      onboardingId: onboarding.id,
      status: onboarding.status,
      progress: onboarding.progress,
      totalTasks: onboarding.totalTasks,
      completedTasks: onboarding.completedTasks,
      startDate: onboarding.startDate,
      completedDate: onboarding.completedDate,
    };
  }

  async getAssignedEmployeeAssetCount() {
    return this.prisma.employeeAsset.count({
      where: {
        ...this.scope.employeeAssetWhere(),
        status: 'ASSIGNED',
        returnedDate: null,
      },
    });
  }
}
