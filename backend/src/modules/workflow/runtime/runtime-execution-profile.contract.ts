import { RuntimeExecutionRule } from './runtime-execution-rule.contract';

export interface RuntimeExecutionProfile {
  readonly runtimeExecutionProfileId: string;

  readonly runtimeExecutionProfileCode: string;

  readonly executionProfileId: string;

  readonly profileName: string;

  readonly displayOrder: number;

  readonly rules: readonly RuntimeExecutionRule[];

  readonly profileCode?: string;
}
