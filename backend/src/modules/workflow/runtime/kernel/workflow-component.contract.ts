import { WorkflowCapabilityMetadata } from './workflow-capability.contract';

export interface WorkflowComponent {
  readonly metadata: WorkflowCapabilityMetadata;
}
