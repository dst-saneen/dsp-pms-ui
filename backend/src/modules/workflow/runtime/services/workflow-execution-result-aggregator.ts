import { Injectable } from '@nestjs/common';

import { WorkflowExecutionResult } from '../kernel';

@Injectable()
export class WorkflowExecutionResultAggregator {
  aggregate(
    results: readonly WorkflowExecutionResult[],
  ): WorkflowExecutionResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    let executedRules = 0;
    let skippedRules = 0;
    let failedRules = 0;

    for (const result of results) {
      executedRules += result.executedRules;
      skippedRules += result.skippedRules;
      failedRules += result.failedRules;

      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }

    return {
      successful: failedRules === 0,
      warnings,
      errors,
      executedRules,
      skippedRules,
      failedRules,
    };
  }
}
