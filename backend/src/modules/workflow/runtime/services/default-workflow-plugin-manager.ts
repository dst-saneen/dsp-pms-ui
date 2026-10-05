import { Injectable } from '@nestjs/common';

import { WorkflowPlugin, WorkflowPluginManager } from '../kernel';

@Injectable()
export class DefaultWorkflowPluginManager implements WorkflowPluginManager {
  private readonly plugins: WorkflowPlugin[] = [];

  register(plugin: WorkflowPlugin): void {
    if (!this.plugins.includes(plugin)) {
      this.plugins.push(plugin);
    }
  }

  unregister(plugin: WorkflowPlugin): void {
    const index = this.plugins.indexOf(plugin);

    if (index >= 0) {
      this.plugins.splice(index, 1);
    }
  }

  getAll(): readonly WorkflowPlugin[] {
    return this.plugins;
  }

  clear(): void {
    this.plugins.length = 0;
  }
}
