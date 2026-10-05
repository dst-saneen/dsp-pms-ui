export interface WorkflowPlugin {
  readonly id: string;

  readonly name: string;

  readonly version: string;

  initialize(): Promise<void>;

  shutdown(): Promise<void>;
}
