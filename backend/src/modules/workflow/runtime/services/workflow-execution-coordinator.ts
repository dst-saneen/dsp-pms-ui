import { Injectable } from '@nestjs/common';

import {
  WorkflowExecutionCoordinator,
  WorkflowRuleExecutor,
} from '../contracts';

import { WorkflowContext, WorkflowExecutionResult } from '../kernel';

import {
  WorkflowInstance,
  DepartmentInstance,
  ContributionInstance,
  ExecutionProfileInstance,
  ExecutionRuleInstance,
} from '../instance';

import { DefaultWorkflowRuleExecutorRegistry } from '../registry';

@Injectable()
export class DefaultWorkflowExecutionCoordinator implements WorkflowExecutionCoordinator {
  constructor(private readonly registry: DefaultWorkflowRuleExecutorRegistry) {}

  async execute(
    workflow: WorkflowInstance,
    context: WorkflowContext,
  ): Promise<readonly WorkflowExecutionResult[]> {
    const results: WorkflowExecutionResult[] = [];

    for (const department of workflow.departments) {
      await this.executeDepartment(workflow, department, context, results);
    }

    return results;
  }

  private async executeDepartment(
    workflow: WorkflowInstance,
    department: DepartmentInstance,
    context: WorkflowContext,
    results: WorkflowExecutionResult[],
  ): Promise<void> {
    for (const contribution of department.contributions) {
      await this.executeContribution(workflow, contribution, context, results);
    }
  }

  private async executeContribution(
    workflow: WorkflowInstance,
    contribution: ContributionInstance,
    context: WorkflowContext,
    results: WorkflowExecutionResult[],
  ): Promise<void> {
    for (const profile of contribution.executionProfiles) {
      await this.executeProfile(workflow, profile, context, results);
    }
  }

  private async executeProfile(
    workflow: WorkflowInstance,
    profile: ExecutionProfileInstance,
    context: WorkflowContext,
    results: WorkflowExecutionResult[],
  ): Promise<void> {
    for (const rule of profile.rules) {
      const result = await this.executeRule(workflow, rule, context);

      if (result) {
        results.push(result);
      }
    }
  }

  private async executeRule(
    workflow: WorkflowInstance,
    rule: ExecutionRuleInstance,
    context: WorkflowContext,
  ): Promise<WorkflowExecutionResult | undefined> {
    const executor = this.registry.resolve(rule);

    if (!executor) {
      return undefined;
    }

    return executor.execute(workflow, rule, context);
  }
}
