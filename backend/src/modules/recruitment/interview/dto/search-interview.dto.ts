import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { InterviewSessionStatus } from '@prisma/client';

import { SearchQueryDto } from '../../../../common/dto/search-query.dto';

export class SearchInterviewDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  jobOpeningId?: string;

  @IsOptional()
  @IsUUID()
  jobApplicationId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(InterviewSessionStatus)
  status?: InterviewSessionStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledTo?: string;
}
