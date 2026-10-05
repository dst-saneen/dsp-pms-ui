import { AssetKind, AssetTrackingMode } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class CreateAssetTypeCommandDto extends OperationCommandDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  assetCategoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  assetTypeName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(AssetKind)
  kind!: AssetKind;

  @IsEnum(AssetTrackingMode)
  trackingMode!: AssetTrackingMode;
}
