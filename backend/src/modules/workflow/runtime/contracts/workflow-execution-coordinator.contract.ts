import { WorkflowInstance } from '../instance';

import { WorkflowContext, WorkflowExecutionResult } from '../kernel';

export interface WorkflowExecutionCoordinator {
  execute(
    workflow: WorkflowInstance,
    context: WorkflowContext,
  ): Promise<readonly WorkflowExecutionResult[]>;
}
