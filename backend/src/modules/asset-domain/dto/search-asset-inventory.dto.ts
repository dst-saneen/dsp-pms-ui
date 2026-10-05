import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
} from '@prisma/client';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

import type { AssetAvailabilityStatus } from '../policies/asset-availability.util';
import type { AssetCatalog } from '../policies/asset-kind-tracking';

const ASSET_AVAILABILITY_STATUSES = [
  'IN_SERVICE',
  'AVAILABLE',
  'ASSIGNED',
  'SEATS_AVAILABLE',
  'FULLY_ALLOCATED',
  'UNAVAILABLE',
] as const satisfies readonly AssetAvailabilityStatus[];

const ASSET_CATALOGS = [
  'PHYSICAL',
  'LICENSE',
] as const satisfies readonly AssetCatalog[];

export class SearchAssetInventoryDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  assetCategoryId?: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string;

  @IsOptional()
  @IsEnum(AssetKind)
  kind?: AssetKind;

  @IsOptional()
  @IsEnum(ASSET_CATALOGS)
  catalog?: AssetCatalog;

  @IsOptional()
  @IsEnum(AssetTrackingMode)
  trackingMode?: AssetTrackingMode;

  @IsOptional()
  @IsEnum(AssetLifecycleStatus)
  lifecycleStatus?: AssetLifecycleStatus;

  @IsOptional()
  @IsEnum(ASSET_AVAILABILITY_STATUSES)
  availabilityStatus?: AssetAvailabilityStatus;

  @IsOptional()
  @IsDateString()
  expiringBefore?: string;
}
