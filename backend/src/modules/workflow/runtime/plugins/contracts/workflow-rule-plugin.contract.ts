import { WorkflowPlugin } from '../../kernel';
import { WorkflowRuleExecutor } from '../../contracts';

export interface WorkflowRulePlugin extends WorkflowPlugin {
  readonly executors: readonly WorkflowRuleExecutor[];
}
