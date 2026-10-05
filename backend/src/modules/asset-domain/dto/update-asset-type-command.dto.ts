import { AssetKind, AssetTrackingMode } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { VersionedCommandDto } from './versioned-command.dto';

export class UpdateAssetTypeCommandDto extends VersionedCommandDto {
  @IsOptional()
  @IsUUID()
  assetCategoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  assetTypeName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsEnum(AssetKind)
  kind?: AssetKind;

  @IsOptional()
  @IsEnum(AssetTrackingMode)
  trackingMode?: AssetTrackingMode;
}
