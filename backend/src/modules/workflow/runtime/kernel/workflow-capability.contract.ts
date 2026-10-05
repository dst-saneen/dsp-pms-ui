export interface WorkflowCapability {
  readonly metadata: WorkflowCapabilityMetadata;
}

export interface WorkflowCapabilityMetadata {
  readonly id: string;

  readonly code: string;

  readonly name: string;

  readonly version: string;

  readonly description?: string;

  readonly category: string;

  readonly tags: readonly string[];
}
