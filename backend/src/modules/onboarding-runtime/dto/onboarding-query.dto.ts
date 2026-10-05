import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { SearchQueryDto } from '../../../common/dto';

export class OnboardingPreflightQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({ example: '2026-08-18' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  overrideTemplateId?: string;
}

export class EmployeeOnboardingListQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  startedFrom?: string;

  @IsOptional()
  @IsDateString()
  startedTo?: string;

  @IsOptional()
  @IsDateString()
  completedFrom?: string;

  @IsOptional()
  @IsDateString()
  completedTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasOverdue?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasUnassignedMandatory?: boolean;
}
