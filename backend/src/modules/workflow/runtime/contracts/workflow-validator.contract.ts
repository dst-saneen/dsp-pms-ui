import { WorkflowContext, WorkflowValidationResult } from '../kernel';

export interface WorkflowValidator {
  validate(context: WorkflowContext): Promise<WorkflowValidationResult>;
}
