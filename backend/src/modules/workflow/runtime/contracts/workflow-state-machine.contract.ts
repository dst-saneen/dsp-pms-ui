import { WorkflowRuntimeStatus } from '../instance';

export interface WorkflowStateMachine {
  start(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus;

  resume(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus;

  complete(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus;

  fail(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus;

  cancel(current: WorkflowRuntimeStatus): WorkflowRuntimeStatus;

  canTransition(
    from: WorkflowRuntimeStatus,
    to: WorkflowRuntimeStatus,
  ): boolean;

  isTerminal(status: WorkflowRuntimeStatus): boolean;

  isActive(status: WorkflowRuntimeStatus): boolean;

  isReady(status: WorkflowRuntimeStatus): boolean;

  isWaiting(status: WorkflowRuntimeStatus): boolean;

  isCompleted(status: WorkflowRuntimeStatus): boolean;

  isCancelled(status: WorkflowRuntimeStatus): boolean;

  isFailed(status: WorkflowRuntimeStatus): boolean;

  isInProgress(status: WorkflowRuntimeStatus): boolean;

  isNotStarted(status: WorkflowRuntimeStatus): boolean;
}
