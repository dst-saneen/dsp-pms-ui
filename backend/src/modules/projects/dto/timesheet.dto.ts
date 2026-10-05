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
  ValidateIf,
} from 'class-validator';

export class CreateTimesheetDto {
  /** Inclusive week start (YYYY-MM-DD). Server derives periodEnd as +6 days. */
  @IsDateString()
  periodStart!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class UpdateTimesheetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string | null;
}

export class AddTimesheetLineDto {
  @IsDateString()
  workDate!: string;

  @IsNumberString()
  hours!: string;

  @ValidateIf((o: AddTimesheetLineDto) => !o.workCategoryId)
  @IsUUID()
  taskId?: string;

  @ValidateIf((o: AddTimesheetLineDto) => !o.taskId)
  @IsUUID()
  workCategoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class UpdateTimesheetLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineExpectedVersion!: number;

  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsNumberString()
  hours?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string | null;

  @IsOptional()
  @IsUUID()
  workCategoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string | null;
}

export class SearchTimesheetsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
