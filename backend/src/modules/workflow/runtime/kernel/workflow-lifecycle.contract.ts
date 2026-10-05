export interface WorkflowLifecycle {
  initialize?(): Promise<void> | void;

  shutdown?(): Promise<void> | void;

  dispose?(): Promise<void> | void;
}
