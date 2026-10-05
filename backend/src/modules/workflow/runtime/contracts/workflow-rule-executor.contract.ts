import { ExecutionRuleInstance, WorkflowInstance } from '../instance';

import { WorkflowContext, WorkflowExecutionResult } from '../kernel';

export interface WorkflowRuleExecutor {
  canExecute(rule: ExecutionRuleInstance): boolean;

  execute(
    workflow: WorkflowInstance,
    rule: ExecutionRuleInstance,
    context: WorkflowContext,
  ): Promise<WorkflowExecutionResult>;
}
