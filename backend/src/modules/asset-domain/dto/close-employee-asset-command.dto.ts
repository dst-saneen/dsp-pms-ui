import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export enum AssetCustodyCloseOutcome {
  RETURNED = 'RETURNED',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export class CloseEmployeeAssetCommandDto extends OperationCommandDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssignmentVersion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion?: number;

  @IsEnum(AssetCustodyCloseOutcome)
  outcome!: AssetCustodyCloseOutcome;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  /** Legacy alias for effectiveDate. */
  @IsOptional()
  @IsDateString()
  returnedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionOnReturn?: string;

  @ValidateIf(
    (dto: CloseEmployeeAssetCommandDto) =>
      dto.outcome === AssetCustodyCloseOutcome.DAMAGED ||
      dto.outcome === AssetCustodyCloseOutcome.LOST,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
