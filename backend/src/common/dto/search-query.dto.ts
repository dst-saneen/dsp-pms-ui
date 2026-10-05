import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from './pagination.dto';

/**
 * Base search DTO.
 * Every searchable endpoint should inherit from this.
 */
export class SearchQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return false;
  })
  @IsBoolean()
  includeInactive = false;
}
