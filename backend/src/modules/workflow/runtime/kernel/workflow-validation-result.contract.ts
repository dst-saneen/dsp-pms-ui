export interface WorkflowValidationResult {
  readonly valid: boolean;

  readonly errors: readonly string[];

  readonly warnings: readonly string[];
}
