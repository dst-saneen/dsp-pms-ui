import { RuntimeExecutionRule } from '../runtime-execution-rule.contract';
import { WorkflowRuntimeStatus } from './workflow-runtime.enums';

export interface ExecutionRuleInstance {
  readonly runtimeExecutionRuleId: string;

  readonly definition: RuntimeExecutionRule;

  readonly status: WorkflowRuntimeStatus;

  readonly startedAt?: Date;

  readonly completedAt?: Date;

  readonly assignedTo?: string;
}
