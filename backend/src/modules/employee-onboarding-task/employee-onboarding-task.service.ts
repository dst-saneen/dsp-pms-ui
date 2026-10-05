import { Injectable } from '@nestjs/common';

import { Prisma, TaskStatus } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { OnboardingFeatureGateService } from '../onboarding-runtime/services/onboarding-feature-gate.service';

import { CompleteOnboardingTaskDto } from './dto/complete-onboarding-task.dto';
import {
  ReopenOnboardingTaskDto,
  SkipOnboardingTaskDto,
  StartOnboardingTaskDto,
} from './dto/task-actions.dto';

@Injectable()
export class EmployeeOnboardingTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly featureGate: OnboardingFeatureGateService,
  ) {}

  async startTask(id: string, dto: StartOnboardingTaskDto) {
    const task = await this.loadScopedTask(id);

    this.assertOnboardingMutable(task.onboarding);

    if (task.status !== TaskStatus.PENDING) {
      throw new DomainConflictException(
        'INVALID_TASK_TRANSITION',
        'Only pending tasks can be started.',
      );
    }

    this.assertDependencyCompleted(task);

    const updated = await this.transitionTask(
      id,
      TaskStatus.PENDING,
      {
        status: TaskStatus.IN_PROGRESS,
        startedDate: new Date(),
        remarks: dto.remarks ?? task.remarks,
      },
      'START',
      task,
    );

    return updated;
  }

  async completeTask(id: string, dto: CompleteOnboardingTaskDto) {
    const task = await this.loadScopedTask(id);

    this.assertOnboardingMutable(task.onboarding);

    if (task.status === TaskStatus.COMPLETED) {
      return task;
    }

    if (
      task.status !== TaskStatus.PENDING &&
      task.status !== TaskStatus.IN_PROGRESS
    ) {
      throw new DomainConflictException(
        'INVALID_TASK_TRANSITION',
        'Only pending or in-progress tasks can be completed.',
      );
    }

    this.assertDependencyCompleted(task);

    const actor = getRequestActor();
    const fromStatus = task.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employeeOnboardingTask.updateMany({
        where: {
          id,
          status: fromStatus,
        },
        data: {
          status: TaskStatus.COMPLETED,
          completedDate: new Date(),
          remarks: dto.remarks ?? task.remarks,
        },
      });

      if (result.count === 0) {
        throw new DomainConflictException(
          'TASK_STATE_CHANGED',
          'Task state changed concurrently. Please refresh and retry.',
        );
      }

      const transitioned = await tx.employeeOnboardingTask.update({
        where: { id },
        data: {
          completedByUser: actor.userId
            ? { connect: { id: actor.userId } }
            : { disconnect: true },
        },
      });

      await this.auditService.log(
        'EmployeeOnboardingTask',
        id,
        'COMPLETE',
        { id: task.id, status: task.status },
        { id, status: transitioned.status },
        { tx },
      );
      await this.recalculateProgress(tx, task.onboardingId);

      return transitioned;
    });

    return updated;
  }

  async skipTask(id: string, dto: SkipOnboardingTaskDto) {
    const task = await this.loadScopedTask(id);

    this.assertOnboardingMutable(task.onboarding);

    if (task.isMandatory) {
      throw new DomainConflictException(
        'MANDATORY_TASK_NOT_SKIPPABLE',
        'Mandatory tasks cannot be skipped.',
      );
    }

    if (!task.allowSkip) {
      throw new DomainConflictException(
        'TASK_SKIP_NOT_ALLOWED',
        'This task does not allow skipping.',
      );
    }

    if (
      task.status !== TaskStatus.PENDING &&
      task.status !== TaskStatus.IN_PROGRESS
    ) {
      throw new DomainConflictException(
        'INVALID_TASK_TRANSITION',
        'Only pending or in-progress tasks can be skipped.',
      );
    }

    this.assertDependencyCompleted(task);

    const fromStatus = task.status;

    const updated = await this.transitionTask(
      id,
      fromStatus,
      {
        status: TaskStatus.SKIPPED,
        remarks: dto.reason,
      },
      'SKIP',
      task,
    );

    return updated;
  }

  async reopenTask(id: string, dto: ReopenOnboardingTaskDto) {
    const task = await this.loadScopedTask(id);

    this.assertOnboardingMutable(task.onboarding);

    if (!task.allowReopen) {
      throw new DomainConflictException(
        'TASK_REOPEN_NOT_ALLOWED',
        'This task does not allow reopening.',
      );
    }

    if (
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.SKIPPED
    ) {
      throw new DomainConflictException(
        'INVALID_TASK_TRANSITION',
        'Only completed or skipped tasks can be reopened.',
      );
    }

    const fromStatus = task.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employeeOnboardingTask.updateMany({
        where: {
          id,
          status: fromStatus,
        },
        data: {
          status: TaskStatus.PENDING,
          completedDate: null,
          startedDate: null,
          attemptNo: task.attemptNo + 1,
          remarks: dto.reason,
        },
      });

      if (result.count === 0) {
        throw new DomainConflictException(
          'TASK_STATE_CHANGED',
          'Task state changed concurrently. Please refresh and retry.',
        );
      }

      const transitioned = await tx.employeeOnboardingTask.update({
        where: { id },
        data: {
          completedByUser: { disconnect: true },
        },
      });

      await this.auditService.log(
        'EmployeeOnboardingTask',
        id,
        'REOPEN',
        { id: task.id, status: task.status },
        { id, status: transitioned.status },
        { tx },
      );
      await this.recalculateProgress(tx, task.onboardingId);

      return transitioned;
    });

    return updated;
  }

  private async loadScopedTask(id: string) {
    const task = await this.prisma.employeeOnboardingTask.findFirst({
      where: {
        id,
        ...this.scopeService.onboardingTaskWhere(),
      },
      include: {
        onboarding: true,
        dependsOnTask: { select: { id: true, status: true } },
      },
    });

    if (!task) {
      throw new DomainNotFoundException(
        'ONBOARDING_TASK_NOT_FOUND',
        'Onboarding task not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(
      task.onboarding.companyId,
      task.onboarding.branchId ?? undefined,
    );

    return task;
  }

  private assertOnboardingMutable(onboarding: { status: TaskStatus }) {
    if (onboarding.status === TaskStatus.COMPLETED) {
      throw new DomainConflictException(
        'ONBOARDING_ALREADY_COMPLETED',
        'Completed onboarding tasks cannot be changed.',
      );
    }

    if (onboarding.status === TaskStatus.CANCELLED) {
      throw new DomainConflictException(
        'ONBOARDING_CANCELLED',
        'Cancelled onboarding tasks cannot be changed.',
      );
    }
  }

  private assertDependencyCompleted(task: {
    dependsOnTask: { status: TaskStatus } | null;
    taskName: string;
  }) {
    if (
      task.dependsOnTask &&
      task.dependsOnTask.status !== TaskStatus.COMPLETED
    ) {
      throw new DomainConflictException(
        'DEPENDENCY_NOT_COMPLETED',
        `Dependency task "${task.taskName}" must be completed first.`,
      );
    }
  }

  private async transitionTask(
    id: string,
    expectedStatus: TaskStatus,
    data: Prisma.EmployeeOnboardingTaskUpdateManyMutationInput,
    action: string,
    previous: { id: string; status: TaskStatus },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.employeeOnboardingTask.updateMany({
        where: {
          id,
          status: expectedStatus,
        },
        data,
      });

      if (result.count === 0) {
        throw new DomainConflictException(
          'TASK_STATE_CHANGED',
          'Task state changed concurrently. Please refresh and retry.',
        );
      }

      const updated = await tx.employeeOnboardingTask.findUniqueOrThrow({
        where: { id },
      });

      await this.auditService.log(
        'EmployeeOnboardingTask',
        id,
        action,
        { id: previous.id, status: previous.status },
        { id, status: updated.status },
        { tx },
      );
      await this.recalculateProgress(tx, updated.onboardingId);

      return updated;
    });
  }

  private async recalculateProgress(
    tx: Prisma.TransactionClient,
    onboardingId: string,
  ) {
    const tasks = await tx.employeeOnboardingTask.findMany({
      where: {
        onboardingId,
        status: { not: TaskStatus.CANCELLED },
      },
      select: { status: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === TaskStatus.COMPLETED,
    ).length;
    const progress =
      totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;

    await tx.employeeOnboarding.update({
      where: { id: onboardingId },
      data: {
        totalTasks,
        completedTasks,
        progress,
      },
    });
  }
}
