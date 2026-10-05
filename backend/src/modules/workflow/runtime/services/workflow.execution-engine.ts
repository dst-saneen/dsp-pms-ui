import { Injectable } from '@nestjs/common';

import {
  WorkflowEngine,
  WorkflowContext,
  WorkflowExecutionResult,
} from '../kernel';

import { WorkflowInstance } from '../instance';

import {
  DefaultWorkflowExecutionCoordinator,
  WorkflowExecutionResultAggregator,
  DefaultWorkflowValidator,
} from './';

@Injectable()
export class DefaultWorkflowExecutionEngine implements WorkflowEngine {
  constructor(
    private readonly validator: DefaultWorkflowValidator,
    private readonly coordinator: DefaultWorkflowExecutionCoordinator,
    private readonly aggregator: WorkflowExecutionResultAggregator,
  ) {}

  async start(context: WorkflowContext): Promise<WorkflowInstance> {
    // TODO
    throw new Error('Workflow instance creation not implemented.');
  }

  async resume(context: WorkflowContext): Promise<WorkflowInstance> {
    // TODO
    throw new Error('Workflow resume not implemented.');
  }

  async cancel(context: WorkflowContext): Promise<WorkflowInstance> {
    // TODO
    throw new Error('Workflow cancellation not implemented.');
  }

  async fail(
    context: WorkflowContext,
    reason?: string,
  ): Promise<WorkflowInstance> {
    // TODO
    throw new Error(`Workflow failure not implemented. ${reason ?? ''}`);
  }

  async complete(context: WorkflowContext): Promise<WorkflowInstance> {
    // TODO
    throw new Error('Workflow completion not implemented.');
  }

  protected async execute(
    workflow: WorkflowInstance,
    context: WorkflowContext,
  ): Promise<WorkflowExecutionResult> {
    const validation = await this.validator.validate(context);

    if (!validation.valid) {
      return {
        successful: false,
        warnings: [],
        errors: validation.errors,
        executedRules: 0,
        skippedRules: 0,
        failedRules: 0,
      };
    }

    const ruleResults = await this.coordinator.execute(workflow, context);

    return this.aggregator.aggregate(ruleResults);
  }
}
