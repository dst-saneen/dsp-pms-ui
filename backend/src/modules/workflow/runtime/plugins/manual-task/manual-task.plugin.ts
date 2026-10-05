import { Injectable } from '@nestjs/common';

import { WorkflowRulePlugin } from '../contracts';

import { ManualTaskRuleExecutor } from './manual-task-rule.executor';

@Injectable()
export class ManualTaskPlugin implements WorkflowRulePlugin {
  readonly id = 'manual-task';

  readonly name = 'Manual Task Plugin';

  readonly version = '1.0.0';

  readonly executors;

  constructor(executor: ManualTaskRuleExecutor) {
    this.executors = [executor];
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
