import {
  ExecutionAction,
  ExecutionType,
  WorkOwnerType,
  WorkType,
} from '@prisma/client';

export interface RuntimeExecutionRule {
  readonly executionType: ExecutionType;
}
