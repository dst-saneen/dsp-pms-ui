import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { SearchQueryDto } from '../../../common/dto';

export enum DepartmentQueueAssignmentState {
  UNASSIGNED = 'UNASSIGNED',
  ASSIGNED = 'ASSIGNED',
  ALL = 'ALL',
}

export enum OnboardingDueStateFilter {
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  ALL = 'ALL',
}

export class DepartmentQueueQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsEnum(DepartmentQueueAssignmentState)
  assignmentState?: DepartmentQueueAssignmentState =
    DepartmentQueueAssignmentState.ALL;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(OnboardingDueStateFilter)
  dueState?: OnboardingDueStateFilter;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class MyOnboardingTasksQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dueState?: string;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsString()
  ownerType?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  executorDepartmentId?: string;
}

export class AssigneeCandidatesQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsIn(['employeeCode', 'displayName'])
  assigneeSortBy?: 'employeeCode' | 'displayName' = 'displayName';
}

export class TaskHistoryQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsIn(['createdAt'])
  historySortBy = 'createdAt' as const;
}

export class AssetCandidatesQueryDto extends SearchQueryDto {}
