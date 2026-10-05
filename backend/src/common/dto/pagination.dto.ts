import { Transform, type TransformFnParams, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { AppConstants } from '../constants';
import { SortOrder } from '../enums';
import { BaseQueryDto } from './base-query.dto';

const SORT_ORDER_VALUES = new Set<string>(Object.values(SortOrder));

/**
 * Standard pagination DTO.
 * Used by every ERP list endpoint.
 */
export class PaginationDto extends BaseQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = AppConstants.Pagination.DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AppConstants.Pagination.MAX_PAGE_SIZE)
  limit = AppConstants.Pagination.DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  sortBy = AppConstants.Sorting.DEFAULT_SORT_BY;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const rawValue: unknown = value;
    if (typeof rawValue !== 'string') {
      return rawValue;
    }
    const normalized = rawValue.toLowerCase();
    if (SORT_ORDER_VALUES.has(normalized)) {
      return normalized;
    }
    return rawValue;
  })
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;
}
