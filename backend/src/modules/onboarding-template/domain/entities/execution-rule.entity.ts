import { ExecutionRuleStatus, RuleOperator, RuleSource } from '../enums';

export class ExecutionRule {
  /**
   * Identity
   */
  id!: string;

  executionProfileId!: string;

  /**
   * Rule
   */
  source!: RuleSource;

  field!: string;

  operator!: RuleOperator;

  value!: string;

  /**
   * Evaluation
   */
  priority!: number;

  status!: ExecutionRuleStatus;

  /**
   * Audit
   */
  createdAt!: Date;

  updatedAt!: Date;
}
