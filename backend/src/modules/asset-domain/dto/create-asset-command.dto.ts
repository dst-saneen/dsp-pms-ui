import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class CreateAssetCardPayloadDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  cardNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  issuer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accessZone?: string;

  @IsDateString()
  issuedDate!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreateAssetLicensePayloadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  vendorName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vaultReference?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  expiresOn?: string;

  @IsOptional()
  @IsDateString()
  renewsOn?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCapacity!: number;
}

export class CreateAssetCommandDto extends OperationCommandDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  departmentId!: string;

  @IsUUID()
  assetTypeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  assetName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelNumber?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  })
  @IsString()
  purchaseCost?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAssetCardPayloadDto)
  card?: CreateAssetCardPayloadDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAssetLicensePayloadDto)
  softwareLicense?: CreateAssetLicensePayloadDto;
}
