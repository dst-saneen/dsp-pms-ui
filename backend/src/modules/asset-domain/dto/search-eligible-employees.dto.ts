import { IsUUID } from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

export class SearchEligibleEmployeesDto extends SearchQueryDto {
  @IsUUID()
  assetId!: string;
}
