import { WorkflowContext } from './workflow-context.contract';
import { WorkflowInstance } from '../instance';

export interface WorkflowEngine {
  start(context: WorkflowContext): Promise<WorkflowInstance>;

  resume(context: WorkflowContext): Promise<WorkflowInstance>;

  cancel(context: WorkflowContext): Promise<WorkflowInstance>;

  fail(context: WorkflowContext, reason?: string): Promise<WorkflowInstance>;

  complete(context: WorkflowContext): Promise<WorkflowInstance>;
}
