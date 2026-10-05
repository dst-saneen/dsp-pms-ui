import { Injectable } from '@nestjs/common';

import type {
  EmployeeOnboardingStatus,
  OnboardingProgressSnapshot,
  OnboardingProgressTaskInput,
} from '../contracts/onboarding-runtime.contracts';

const TERMINAL_TASK_STATUSES = new Set(['COMPLETED', 'SKIPPED', 'WAIVED']);

const ACTIVE_TASK_STATUSES = new Set(['PENDING', 'IN_PROGRESS']);

@Injectable()
export class OnboardingProgressService {
  calculateFromTasks(
    tasks: OnboardingProgressTaskInput[],
    onboardingStatus: EmployeeOnboardingStatus = 'IN_PROGRESS',
  ): OnboardingProgressSnapshot {
    const activeTasks = tasks.filter((task) => task.status !== 'CANCELLED');
    const total = activeTasks.length;

    let completed = 0;
    let skipped = 0;
    let waived = 0;
    let mandatoryRemaining = 0;
    let unfinishedOptional = 0;
    let unassignedMandatory = 0;
    let overdue = 0;

    for (const task of activeTasks) {
      if (task.status === 'COMPLETED') {
        completed += 1;
      } else if (task.status === 'SKIPPED') {
        skipped += 1;
      } else if (task.status === 'WAIVED') {
        waived += 1;
      }

      if (
        task.isMandatory &&
        task.status !== 'COMPLETED' &&
        task.status !== 'WAIVED'
      ) {
        mandatoryRemaining += 1;
      }

      if (!task.isMandatory && ACTIVE_TASK_STATUSES.has(task.status)) {
        unfinishedOptional += 1;
      }

      if (
        task.isMandatory &&
        !task.assignedToUserId &&
        ACTIVE_TASK_STATUSES.has(task.status)
      ) {
        unassignedMandatory += 1;
      }

      if (
        ACTIVE_TASK_STATUSES.has(task.status) &&
        task.dueState === 'OVERDUE'
      ) {
        overdue += 1;
      }
    }

    const terminal = completed + skipped + waived;
    const percent = total === 0 ? 0 : Math.floor((terminal / total) * 100);
    const canComplete =
      onboardingStatus === 'IN_PROGRESS' && mandatoryRemaining === 0;

    return {
      total,
      completed,
      skipped,
      waived,
      terminal,
      mandatoryRemaining,
      unfinishedOptional,
      unassignedMandatory,
      overdue,
      percent,
      canComplete,
    };
  }

  isTerminalStatus(status: string): boolean {
    return TERMINAL_TASK_STATUSES.has(status);
  }
}
