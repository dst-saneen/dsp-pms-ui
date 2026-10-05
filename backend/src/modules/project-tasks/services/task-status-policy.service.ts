import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskStatus } from '../constants/task-status.constant';

@Injectable()
export class TaskStatusPolicyService {
  private readonly transitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.OPEN]: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],

    [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],

    [TaskStatus.IN_PROGRESS]: [TaskStatus.WAITING_REVIEW, TaskStatus.CANCELLED],

    [TaskStatus.WAITING_REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED],

    [TaskStatus.COMPLETED]: [TaskStatus.CLOSED],

    [TaskStatus.CANCELLED]: [],

    [TaskStatus.CLOSED]: [],
  };

  validateTransition(current: TaskStatus, next: TaskStatus): void {
    const allowed = this.transitions[current] ?? [];

    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid task status transition from ${current} to ${next}`,
      );
    }
  }

  getAllowedTransitions(status: TaskStatus): TaskStatus[] {
    return this.transitions[status] ?? [];
  }
}
