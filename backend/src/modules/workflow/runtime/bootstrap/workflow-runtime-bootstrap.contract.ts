export interface WorkflowRuntimeBootstrap {
  initialize(): Promise<void>;

  shutdown(): Promise<void>;
}
