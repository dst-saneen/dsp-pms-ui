import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import { ReferenceType } from '@prisma/client';

import {
  RUNTIME_TASK_OWNER_TYPES,
  RUNTIME_TASK_WORK_TYPES,
} from './create-onboarding-template-task.dto';

export class UpdateOnboardingTemplateTaskDto {
  @IsOptional()
  @IsString()
  taskName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceNo?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSkip?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReopen?: boolean;

  @IsOptional()
  @IsIn(RUNTIME_TASK_WORK_TYPES)
  workType?: (typeof RUNTIME_TASK_WORK_TYPES)[number];

  @IsOptional()
  @IsIn(RUNTIME_TASK_OWNER_TYPES)
  ownerType?: (typeof RUNTIME_TASK_OWNER_TYPES)[number];

  @IsOptional()
  @IsIn([ReferenceType.ASSET_TYPE])
  referenceType?: typeof ReferenceType.ASSET_TYPE | null;

  @IsOptional()
  @IsString()
  referenceId?: string | null;

  @IsOptional()
  @IsUUID()
  dependsOnTaskId?: string | null;

  @IsOptional()
  @IsInt()
  dueDays?: number | null;

  @IsInt()
  @Min(1)
  expectedVersion: number;
}
