import { WorkflowExecutionProfile } from '../contracts';

import { RuntimeExecutionProfile } from '../runtime';

import { ExecutionRuleRuntimeTransformer } from './execution-rule-runtime.transformer';

export class ExecutionProfileRuntimeTransformer {
  constructor(
    private readonly ruleTransformer = new ExecutionRuleRuntimeTransformer(),
  ) {}

  transform(source: WorkflowExecutionProfile): RuntimeExecutionProfile {
    return {
      runtimeExecutionProfileId: source.id,

      runtimeExecutionProfileCode: source.profileCode ?? source.id,

      executionProfileId: source.id,

      profileCode: source.profileCode,

      profileName: source.profileName,

      displayOrder: source.displayOrder,

      rules: source.rules.map((rule) => this.ruleTransformer.transform(rule)),
    };
  }
}
