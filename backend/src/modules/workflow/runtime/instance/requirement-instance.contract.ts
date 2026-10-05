import { RuntimeRequirement } from '../runtime-requirement.contract';
import { WorkflowRuntimeStatus } from './workflow-runtime.enums';

export interface RequirementInstance {
  readonly runtimeRequirementId: string;

  readonly definition: RuntimeRequirement;

  readonly status: WorkflowRuntimeStatus;

  readonly value?: string;
}
