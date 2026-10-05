import { WorkflowContext } from '../kernel';
import { ExecutionRuleInstance, WorkflowInstance } from '../instance';

export interface WorkflowTaskProvider {
  createTask(
    workflow: WorkflowInstance,
    rule: ExecutionRuleInstance,
    context: WorkflowContext,
  ): Promise<string>;

  completeTask(taskId: string): Promise<void>;

  cancelTask(taskId: string): Promise<void>;
}
