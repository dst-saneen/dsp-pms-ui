import { WorkflowPlugin } from './workflow-plugin.contract';

export interface WorkflowPluginManager {
  register(plugin: WorkflowPlugin): void;

  unregister(plugin: WorkflowPlugin): void;

  getAll(): readonly WorkflowPlugin[];

  clear(): void;
}
