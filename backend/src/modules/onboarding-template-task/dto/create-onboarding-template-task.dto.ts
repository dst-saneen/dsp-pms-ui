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

export const RUNTIME_TASK_WORK_TYPES = ['CHECKLIST', 'ASSET'] as const;
export const RUNTIME_TASK_OWNER_TYPES = [
  'DEPARTMENT',
  'EMPLOYEE',
  'MANAGER',
] as const;

export class CreateOnboardingTemplateTaskDto {
  @IsUUID()
  taskGroupId: string;

  @IsString()
  taskName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  sequenceNo: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsBoolean()
  isMandatory: boolean;

  @IsBoolean()
  allowSkip: boolean;

  @IsBoolean()
  allowReopen: boolean;

  @IsIn(RUNTIME_TASK_WORK_TYPES)
  workType: (typeof RUNTIME_TASK_WORK_TYPES)[number];

  @IsIn(RUNTIME_TASK_OWNER_TYPES)
  ownerType: (typeof RUNTIME_TASK_OWNER_TYPES)[number];

  @IsOptional()
  @IsIn([ReferenceType.ASSET_TYPE])
  referenceType?: typeof ReferenceType.ASSET_TYPE;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsUUID()
  dependsOnTaskId?: string;

  @IsOptional()
  @IsInt()
  dueDays?: number;
}
