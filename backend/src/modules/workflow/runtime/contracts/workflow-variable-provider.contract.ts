import { WorkflowContext } from '../kernel';

export interface WorkflowVariableProvider {
  get<T = unknown>(
    name: string,
    context: WorkflowContext,
  ): Promise<T | undefined>;

  has(name: string, context: WorkflowContext): Promise<boolean>;

  set<T = unknown>(
    name: string,
    value: T,
    context: WorkflowContext,
  ): Promise<void>;

  remove(name: string, context: WorkflowContext): Promise<void>;

  getAll(context: WorkflowContext): Promise<ReadonlyMap<string, unknown>>;
}
