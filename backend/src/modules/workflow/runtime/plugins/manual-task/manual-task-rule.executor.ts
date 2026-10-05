import { Injectable } from '@nestjs/common';

import { WorkflowRuleExecutor, WorkflowTaskProvider } from '../../contracts';

import { ExecutionRuleInstance, WorkflowInstance } from '../../instance';

import { WorkflowContext, WorkflowExecutionResult } from '../../kernel';

import { ExecutionType } from '@prisma/client';

@Injectable()
export class ManualTaskRuleExecutor implements WorkflowRuleExecutor {
  canExecute(rule: ExecutionRuleInstance): boolean {
    return rule.definition.executionType === ExecutionType.TASK;
  }

  async execute(
    workflow: WorkflowInstance,
    rule: ExecutionRuleInstance,
    context: WorkflowContext,
  ): Promise<WorkflowExecutionResult> {
    // TODO:
    // Call WorkflowTaskProvider after DI tokens
    // are introduced.

    return {
      successful: true,
      warnings: [],
      errors: [],
      executedRules: 1,
      skippedRules: 0,
      failedRules: 0,
    };
  }
}
