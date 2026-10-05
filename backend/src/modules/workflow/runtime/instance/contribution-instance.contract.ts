import { RuntimeContribution } from '../runtime-contribution.contract';
import { WorkflowRuntimeStatus } from './workflow-runtime.enums';

import { RequirementInstance } from './requirement-instance.contract';
import { ExecutionProfileInstance } from './execution-profile-instance.contract';

export interface ContributionInstance {
  readonly runtimeContributionId: string;

  readonly definition: RuntimeContribution;

  readonly status: WorkflowRuntimeStatus;

  readonly requirements: readonly RequirementInstance[];

  readonly executionProfiles: readonly ExecutionProfileInstance[];
}
