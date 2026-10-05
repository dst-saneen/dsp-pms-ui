import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { SearchQueryDto } from '../../../../common/dto/search-query.dto';
import { JobApplicationStatus } from '@prisma/client';

export class SearchJobApplicationDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  jobOpeningId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(JobApplicationStatus)
  status?: JobApplicationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  submittedFrom?: string;

  @IsOptional()
  @IsDateString()
  submittedTo?: string;
}
