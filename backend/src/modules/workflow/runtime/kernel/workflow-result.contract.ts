export interface WorkflowResult {
  readonly successful: boolean;

  readonly message?: string;

  readonly warnings: readonly string[];

  readonly errors: readonly string[];
}
