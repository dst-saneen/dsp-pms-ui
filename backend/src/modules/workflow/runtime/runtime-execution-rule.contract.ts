import {
  ExecutionAction,
  ExecutionType,
  WorkOwnerType,
  WorkType,
} from '@prisma/client';

export interface RuntimeExecutionRule {
  readonly runtimeExecutionRuleId: string;

  readonly runtimeExecutionRuleCode: string;

  readonly executionRuleId: string;

  readonly sequenceNo: number;

  readonly ownerType: WorkOwnerType;

  readonly executionType: ExecutionType;

  readonly action: ExecutionAction;

  readonly workType: WorkType;

  readonly approvalWorkflowId?: string;

  readonly dueDays?: number;

  readonly reminderIntervalDays?: number;

  readonly estimatedDurationMinutes?: number;

  readonly conditionExpression?: string;

  readonly autoComplete: boolean;

  readonly allowReopen: boolean;
}
