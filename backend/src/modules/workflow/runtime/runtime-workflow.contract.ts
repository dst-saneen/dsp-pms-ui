import { RuntimeDepartment } from './runtime-department.contract';

export interface RuntimeWorkflow {
  readonly workflowId: string;

  readonly workflowCode: string;

  readonly templateId: string;

  readonly templateVersionId: string;

  readonly departments: readonly RuntimeDepartment[];
}
