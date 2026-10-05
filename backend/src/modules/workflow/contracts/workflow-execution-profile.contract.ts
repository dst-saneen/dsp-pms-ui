import { WorkflowExecutionRule } from './workflow-execution-rule.contract';

export interface WorkflowExecutionProfile {
  readonly id: string;

  readonly profileCode?: string;

  readonly profileName: string;

  readonly description?: string;

  readonly displayOrder: number;

  readonly isDefault: boolean;

  readonly rules: readonly WorkflowExecutionRule[];
}
