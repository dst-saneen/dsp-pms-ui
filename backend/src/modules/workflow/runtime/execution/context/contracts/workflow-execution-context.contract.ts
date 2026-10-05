import { WorkflowVariables } from './workflow-variables.contract';

export interface WorkflowExecutionContext {
  readonly companyId: string;

  readonly organizationId?: string;

  readonly workflowDefinitionId: string;

  readonly workflowInstanceId: string;

  readonly initiatorId?: string;

  readonly subjectId?: string;

  readonly correlationId?: string;

  readonly payload: Readonly<Record<string, unknown>>;

  readonly variables: WorkflowVariables;
}
