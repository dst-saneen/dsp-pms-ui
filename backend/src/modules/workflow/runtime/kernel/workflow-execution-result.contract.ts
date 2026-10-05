import { WorkflowResult } from './workflow-result.contract';

export interface WorkflowExecutionResult extends WorkflowResult {
  readonly executedRules: number;

  readonly skippedRules: number;

  readonly failedRules: number;
}
