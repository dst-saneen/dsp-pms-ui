import { IsOptional, IsUUID } from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

export class SearchAssetCategoryDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
