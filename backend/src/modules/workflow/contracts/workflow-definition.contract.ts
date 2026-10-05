import { WorkflowTemplate } from './workflow-template.contract';
import { WorkflowVersion } from './workflow-version.contract';
import { WorkflowDepartment } from './workflow-department.contract';

export interface WorkflowDefinition {
  readonly template: WorkflowTemplate;

  readonly version: WorkflowVersion;

  readonly departments: readonly WorkflowDepartment[];
}
