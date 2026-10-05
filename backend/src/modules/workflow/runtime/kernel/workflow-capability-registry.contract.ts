import { WorkflowCapability } from './workflow-capability.contract';

export interface WorkflowCapabilityRegistry {
  register(capability: WorkflowCapability): void;

  unregister(capabilityId: string): void;

  get(capabilityId: string): WorkflowCapability | undefined;

  has(capabilityId: string): boolean;

  getAll(): readonly WorkflowCapability[];

  findByCategory(category: string): readonly WorkflowCapability[];
}
