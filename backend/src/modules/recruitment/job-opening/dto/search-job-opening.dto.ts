import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

import { SearchQueryDto } from '../../../../common/dto/search-query.dto';
import { JobOpeningStatus } from '@prisma/client';

export class SearchJobOpeningDto extends SearchQueryDto {
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
  hiringManagerEmployeeId?: string;

  @IsOptional()
  @IsEnum(JobOpeningStatus)
  status?: JobOpeningStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;
}
