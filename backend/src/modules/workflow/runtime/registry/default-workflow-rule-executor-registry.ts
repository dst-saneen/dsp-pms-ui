import { Injectable } from '@nestjs/common';

import { WorkflowRuleExecutor } from '../contracts';

import { ExecutionRuleInstance } from '../instance';

import { WorkflowRuleExecutorRegistry } from './workflow-rule-executor-registry.contract';

@Injectable()
export class DefaultWorkflowRuleExecutorRegistry implements WorkflowRuleExecutorRegistry {
  private readonly executors: WorkflowRuleExecutor[] = [];

  register(executor: WorkflowRuleExecutor): void {
    if (!this.executors.includes(executor)) {
      this.executors.push(executor);
    }
  }

  unregister(executor: WorkflowRuleExecutor): void {
    const index = this.executors.indexOf(executor);

    if (index >= 0) {
      this.executors.splice(index, 1);
    }
  }

  resolve(rule: ExecutionRuleInstance): WorkflowRuleExecutor | undefined {
    return this.executors.find((executor) => executor.canExecute(rule));
  }

  getAll(): readonly WorkflowRuleExecutor[] {
    return this.executors;
  }

  clear(): void {
    this.executors.length = 0;
  }
}
