export interface WorkflowError {
  readonly code: string;

  readonly message: string;

  readonly details?: unknown;

  readonly recoverable: boolean;
}
