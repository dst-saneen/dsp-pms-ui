import { WorkflowInstance } from '../instance';

export interface WorkflowRuntimeStore {
  create(workflow: WorkflowInstance): Promise<void>;

  update(workflow: WorkflowInstance): Promise<void>;

  delete(workflowId: string): Promise<void>;

  exists(workflowId: string): Promise<boolean>;

  findById(workflowId: string): Promise<WorkflowInstance | undefined>;
}
