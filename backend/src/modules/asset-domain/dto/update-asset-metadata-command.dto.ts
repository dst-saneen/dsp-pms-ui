import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { VersionedCommandDto } from './versioned-command.dto';

export class UpdateAssetCardMetadataDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  issuer?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accessZone?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;
}

export class UpdateAssetLicenseMetadataDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  vendorName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  productName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractReference?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vaultReference?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsDateString()
  startsOn?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsDateString()
  expiresOn?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsDateString()
  renewsOn?: string | null;
}

export class UpdateAssetMetadataCommandDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  assetName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelNumber?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  purchaseCost?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAssetCardMetadataDto)
  cardMetadata?: UpdateAssetCardMetadataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAssetLicenseMetadataDto)
  licenseMetadata?: UpdateAssetLicenseMetadataDto;
}
