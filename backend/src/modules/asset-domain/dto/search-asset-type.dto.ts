import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssetKind, AssetTrackingMode } from '@prisma/client';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

export class SearchAssetTypeDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  assetCategoryId?: string;

  @IsOptional()
  @IsEnum(AssetKind)
  kind?: AssetKind;

  @IsOptional()
  @IsEnum(AssetTrackingMode)
  trackingMode?: AssetTrackingMode;
}
