import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { JobOpeningCriterionDto } from './job-opening-criterion.dto';

export class CreateJobOpeningDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  departmentId!: string;

  @IsUUID()
  designationId!: string;

  @IsUUID()
  hiringManagerEmployeeId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcountTotal?: number;

  @IsOptional()
  @IsDateString()
  targetJoiningDate?: string;

  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => JobOpeningCriterionDto)
  criteria!: JobOpeningCriterionDto[];
}
