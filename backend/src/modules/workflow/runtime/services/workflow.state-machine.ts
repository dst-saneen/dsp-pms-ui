import { Injectable } from '@nestjs/common';

import { WorkflowStateMachine } from '../contracts';
import { WorkflowRuntimeStatus } from '../instance';
import { InvalidWorkflowTransitionError } from '../errors/invalid-workflow-transition.error';

@Injectable()
export class DefaultWorkflowStateMachine implements WorkflowStateMachine {
  private readonly transitions = new Map<
    WorkflowRuntimeStatus,
    ReadonlySet<WorkflowRuntimeStatus>
  >([
    [
      WorkflowRuntimeStatus.NOT_STARTED,
      new Set([
        WorkflowRuntimeStatus.READY,
        WorkflowRuntimeStatus.CANCELLED,
        WorkflowRuntimeStatus.SKIPPED,
      ]),
    ],

    [
      WorkflowRuntimeStatus.READY,
      new Set([
        WorkflowRuntimeStatus.IN_PROGRESS,
        WorkflowRuntimeStatus.CANCELLED,
        WorkflowRuntimeStatus.SKIPPED,
      ]),
    ],

    [
      WorkflowRuntimeStatus.IN_PROGRESS,
      new Set([
        WorkflowRuntimeStatus.WAITING,
        WorkflowRuntimeStatus.COMPLETED,
        WorkflowRuntimeStatus.FAILED,
        WorkflowRuntimeStatus.CANCELLED,
      ]),
    ],

    [
      WorkflowRuntimeStatus.WAITING,
      new Set([
        WorkflowRuntimeStatus.IN_PROGRESS,
        WorkflowRuntimeStatus.COMPLETED,
        WorkflowRuntimeStatus.FAILED,
        WorkflowRuntimeStatus.CANCELLED,
      ]),
    ],

    [
      WorkflowRuntimeStatus.FAILED,
      new Set([WorkflowRuntimeStatus.READY, WorkflowRuntimeStatus.CANCELLED]),
    ],

    [WorkflowRuntimeStatus.COMPLETED, new Set()],

    [WorkflowRuntimeStatus.CANCELLED, new Set()],

    [WorkflowRuntimeStatus.SKIPPED, new Set()],
  ]);

  canTransition(
    from: WorkflowRuntimeStatus,
    to: WorkflowRuntimeStatus,
  ): boolean {
    return this.transitions.get(from)?.has(to) ?? false;
  }

  transition(
    current: WorkflowRuntimeStatus,
    next: WorkflowRuntimeStatus,
  ): WorkflowRuntimeStatus {
    if (!this.canTransition(current, next)) {
      throw new InvalidWorkflowTransitionError(current, next);
    }

    return next;
  }

  isTerminal(status: WorkflowRuntimeStatus): boolean {
    return (
      status === WorkflowRuntimeStatus.COMPLETED ||
      status === WorkflowRuntimeStatus.FAILED ||
      status === WorkflowRuntimeStatus.CANCELLED ||
      status === WorkflowRuntimeStatus.SKIPPED
    );
  }

  isActive(status: WorkflowRuntimeStatus): boolean {
    return (
      status === WorkflowRuntimeStatus.READY ||
      status === WorkflowRuntimeStatus.IN_PROGRESS ||
      status === WorkflowRuntimeStatus.WAITING
    );
  }

  isReady(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.READY;
  }

  isWaiting(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.WAITING;
  }

  isCompleted(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.COMPLETED;
  }

  isCancelled(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.CANCELLED;
  }

  isFailed(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.FAILED;
  }

  isInProgress(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.IN_PROGRESS;
  }

  isNotStarted(status: WorkflowRuntimeStatus): boolean {
    return status === WorkflowRuntimeStatus.NOT_STARTED;
  }

  start(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus {
    return this.transition(current, WorkflowRuntimeStatus.IN_PROGRESS);
  }

  resume(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus {
    return this.transition(current, WorkflowRuntimeStatus.IN_PROGRESS);
  }

  complete(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus {
    return this.transition(current, WorkflowRuntimeStatus.COMPLETED);
  }

  fail(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus {
    return this.transition(current, WorkflowRuntimeStatus.FAILED);
  }

  cancel(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus {
    return this.transition(current, WorkflowRuntimeStatus.CANCELLED);
  }
}
