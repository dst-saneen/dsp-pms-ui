import { RuntimeExecutionProfile } from '../runtime-execution-profile.contract';
import { WorkflowRuntimeStatus } from './workflow-runtime.enums';

import { ExecutionRuleInstance } from './execution-rule-instance.contract';

export interface ExecutionProfileInstance {
  readonly runtimeExecutionProfileId: string;

  readonly definition: RuntimeExecutionProfile;

  readonly status: WorkflowRuntimeStatus;

  readonly rules: readonly ExecutionRuleInstance[];
}
