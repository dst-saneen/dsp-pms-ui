import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class CompleteAssetRepairCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionNote?: string;
}

export class ResizeLicensePoolCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCapacity!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class CorrectAssetIdentifierCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cardNumber?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class CardExactLookupDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  cardNumber!: string;

  @IsIn(['INVENTORY_VERIFY', 'ASSIGNMENT_VERIFY', 'SECURITY_RECONCILIATION'])
  purposeCode!:
    'INVENTORY_VERIFY' | 'ASSIGNMENT_VERIFY' | 'SECURITY_RECONCILIATION';
}
