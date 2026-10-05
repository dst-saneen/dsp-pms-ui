import { ExecutionRuleInstance } from '../instance';

import { WorkflowRuleExecutor } from '../contracts';

export interface WorkflowRuleExecutorRegistry {
  register(executor: WorkflowRuleExecutor): void;

  unregister(executor: WorkflowRuleExecutor): void;

  resolve(rule: ExecutionRuleInstance): WorkflowRuleExecutor | undefined;

  getAll(): readonly WorkflowRuleExecutor[];

  clear(): void;
}
