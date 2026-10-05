import { Injectable } from '@nestjs/common';

import { WorkflowPlugin } from '../kernel';
import { DefaultWorkflowPluginManager } from '../services';
import { DefaultWorkflowRuleExecutorRegistry } from '../registry';

import { WorkflowRulePlugin } from '../plugins/contracts';

import { WorkflowRuntimeBootstrap } from './workflow-runtime-bootstrap.contract';

@Injectable()
export class DefaultWorkflowRuntimeBootstrap implements WorkflowRuntimeBootstrap {
  constructor(
    private readonly pluginManager: DefaultWorkflowPluginManager,
    private readonly registry: DefaultWorkflowRuleExecutorRegistry,
  ) {}

  async initialize(): Promise<void> {
    for (const plugin of this.pluginManager.getAll()) {
      await plugin.initialize();

      if (this.isRulePlugin(plugin)) {
        for (const executor of plugin.executors) {
          this.registry.register(executor);
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    const plugins = [...this.pluginManager.getAll()].reverse();

    for (const plugin of plugins) {
      await plugin.shutdown();
    }

    this.registry.clear();
  }

  private isRulePlugin(plugin: WorkflowPlugin): plugin is WorkflowRulePlugin {
    return 'executors' in plugin;
  }
}
