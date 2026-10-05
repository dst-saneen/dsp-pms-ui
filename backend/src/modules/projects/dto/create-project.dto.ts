import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectType, ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  projectName!: string;

  @IsEnum(ProjectType)
  projectType!: ProjectType;

  @IsOptional()
  @IsUUID()
  businessPartyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  expectedIncome?: string;

  @IsOptional()
  @IsNumberString()
  expenseBudget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class UpdateProjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectName?: string;

  @IsOptional()
  @IsUUID()
  businessPartyId?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  projectManagerId?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsNumberString()
  expectedIncome?: string | null;

  @IsOptional()
  @IsNumberString()
  expenseBudget?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}

export class SearchProjectsDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsIn(['projectCode', 'projectName', 'status', 'createdAt'])
  sortBy?: 'projectCode' | 'projectName' | 'status' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
