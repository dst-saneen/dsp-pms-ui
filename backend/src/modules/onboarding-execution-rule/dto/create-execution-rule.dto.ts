import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import {
  ExecutionAction,
  ExecutionType,
  WorkOwnerType,
  WorkType,
} from '@prisma/client';

export class CreateExecutionRuleDto {
  @IsUUID()
  executionProfileId: string;

  @IsInt()
  @Min(1)
  sequenceNo: number;

  @IsEnum(WorkOwnerType)
  ownerType: WorkOwnerType;

  @IsEnum(ExecutionType)
  executionType: ExecutionType;

  @IsEnum(ExecutionAction)
  action: ExecutionAction;

  @IsEnum(WorkType)
  workType: WorkType;

  @IsOptional()
  @IsUUID()
  approvalWorkflowId?: string;

  @IsOptional()
  @IsInt()
  dueDays?: number;

  @IsOptional()
  @IsInt()
  reminderIntervalDays?: number;

  @IsOptional()
  @IsInt()
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsString()
  conditionExpression?: string;

  @IsOptional()
  @IsBoolean()
  autoComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReopen?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
