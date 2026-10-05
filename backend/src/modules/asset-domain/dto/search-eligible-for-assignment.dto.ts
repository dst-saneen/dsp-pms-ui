import { IsUUID } from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

export class SearchEligibleForAssignmentDto extends SearchQueryDto {
  @IsUUID()
  employeeId!: string;
}
