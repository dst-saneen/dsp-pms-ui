import { RuntimeWorkflow } from '../runtime-workflow.contract';
import { WorkflowRuntimeStatus } from './workflow-runtime.enums';
import { DepartmentInstance } from './department-instance.contract';

export interface WorkflowInstance {
  readonly workflowInstanceId: string;

  readonly workflow: RuntimeWorkflow;

  readonly status: WorkflowRuntimeStatus;

  readonly startedAt?: Date;

  readonly completedAt?: Date;

  readonly departments: readonly DepartmentInstance[];
}
