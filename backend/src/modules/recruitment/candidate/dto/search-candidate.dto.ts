import { IsOptional, IsString, IsUUID } from 'class-validator';

import { SearchQueryDto } from '../../../../common/dto/search-query.dto';

export class SearchCandidateDto extends SearchQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  companyGroupId?: string;
}
