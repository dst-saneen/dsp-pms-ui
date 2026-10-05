import { Injectable } from '@nestjs/common';

import { WorkflowValidator } from '../contracts';

import { WorkflowContext, WorkflowValidationResult } from '../kernel';

@Injectable()
export class DefaultWorkflowValidator implements WorkflowValidator {
  async validate(context: WorkflowContext): Promise<WorkflowValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!context.workflow) {
      errors.push('Workflow instance is required.');
    }

    if (context.workflow && context.workflow.departments.length === 0) {
      warnings.push('Workflow contains no departments.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
