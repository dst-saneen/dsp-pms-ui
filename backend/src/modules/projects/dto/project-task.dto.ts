import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProjectTaskDto {
  @IsUUID()
  @IsNotEmpty()
  stageId!: string;

  /** Optional — when omitted, server generates from taskName. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taskCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  taskName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  priority?: string;

  @IsOptional()
  @IsNumberString()
  plannedHours?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class UpdateProjectTaskDto {
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
  taskName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  priority?: string;

  @IsOptional()
  @IsNumberString()
  plannedHours?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}

export class AssignProjectTaskDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role!: string;

  @IsOptional()
  @IsNumberString()
  plannedHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class UnassignProjectTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
