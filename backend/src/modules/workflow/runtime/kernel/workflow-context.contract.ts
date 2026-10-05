import { WorkflowInstance } from '../instance';

export interface WorkflowContext {
  readonly workflow: WorkflowInstance;

  readonly variables: ReadonlyMap<string, unknown>;

  readonly execution: WorkflowExecutionContext;

  readonly services: WorkflowServiceContext;

  readonly metadata: WorkflowMetadataContext;

  readonly extensions: ReadonlyMap<string, unknown>;
}

export interface WorkflowExecutionContext {
  readonly companyId: string;

  readonly initiatedBy?: string;

  readonly correlationId?: string;

  readonly executionId: string;

  readonly startedAt: Date;
}

export interface WorkflowMetadataContext {
  readonly environment?: string;

  readonly tenantCode?: string;

  readonly tags: readonly string[];
}

export interface WorkflowServiceContext {
  readonly clock: WorkflowClock;

  readonly eventPublisher: WorkflowEventPublisher;
}

export interface WorkflowClock {
  now(): Date;
}

export interface WorkflowEventPublisher {
  publish(event: unknown): Promise<void>;
}
