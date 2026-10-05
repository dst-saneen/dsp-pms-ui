import { WorkflowExecutionRule } from '../contracts';

import { RuntimeExecutionRule } from '../runtime';

export class ExecutionRuleRuntimeTransformer {
  transform(source: WorkflowExecutionRule): RuntimeExecutionRule {
    return {
      runtimeExecutionRuleId: source.id,

      runtimeExecutionRuleCode: source.id,

      executionRuleId: source.id,

      sequenceNo: source.sequenceNo,

      ownerType: source.ownerType,

      executionType: source.executionType,

      action: source.action,

      workType: source.workType,

      approvalWorkflowId: source.approvalWorkflowId,

      dueDays: source.dueDays,

      reminderIntervalDays: source.reminderIntervalDays,

      estimatedDurationMinutes: source.estimatedDurationMinutes,

      conditionExpression: source.conditionExpression,

      autoComplete: source.autoComplete,

      allowReopen: source.allowReopen,
    };
  }
}
