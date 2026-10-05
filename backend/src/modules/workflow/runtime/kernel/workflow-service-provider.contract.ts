export interface WorkflowServiceProvider {
  get<T>(token: string): T | undefined;

  has(token: string): boolean;
}
