export interface ActorContext {
  readonly companyId: string;

  readonly workflowId: string;

  readonly workflowInstanceId?: string;

  readonly subjectId?: string;

  readonly initiatorId?: string;

  readonly payload?: Record<string, unknown>;
}
