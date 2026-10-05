import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { JobOfferStatus } from '@prisma/client';

import { SearchQueryDto } from '../../../../common/dto/search-query.dto';

export class SearchOfferDto extends SearchQueryDto {
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
  @IsEnum(JobOfferStatus)
  status?: JobOfferStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
