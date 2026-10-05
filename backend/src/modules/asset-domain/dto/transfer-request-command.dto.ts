import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  AssetCustodyRequestStatus,
  AssetCustodyRequestType,
  AssetCustodyTargetType,
  AssetTransferStatus,
} from '@prisma/client';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';
import { OperationCommandDto } from './operation-command.dto';

export class RequestAssetTransferCommandDto extends OperationCommandDto {
  @IsUUID()
  toDepartmentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;
}

export class AcceptAssetTransferCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTransferVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionNote?: string;
}

export class RejectAssetTransferCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTransferVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  decisionNote!: string;
}

export class CancelAssetTransferCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTransferVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ForceAssetTransferCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTransferVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  forceReason!: string;
}

export class SearchAssetTransferDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  fromDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  toDepartmentId?: string;

  @IsOptional()
  @IsEnum(AssetTransferStatus)
  status?: AssetTransferStatus;
}

export class CreateMyAssetRequestDto extends OperationCommandDto {
  @IsEnum(AssetCustodyTargetType)
  targetType!: AssetCustodyTargetType;

  @IsUUID()
  targetId!: string;

  @IsEnum(AssetCustodyRequestType)
  requestType!: AssetCustodyRequestType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTargetVersion!: number;

  @ValidateIf(
    (dto: CreateMyAssetRequestDto) =>
      dto.requestType === AssetCustodyRequestType.REPORT_DAMAGED ||
      dto.requestType === AssetCustodyRequestType.REPORT_LOST,
  )
  @IsDateString()
  occurredOn?: string;

  @ValidateIf(
    (dto: CreateMyAssetRequestDto) =>
      dto.requestType === AssetCustodyRequestType.REPORT_DAMAGED ||
      dto.requestType === AssetCustodyRequestType.REPORT_LOST,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  employeeNote?: string;
}

export class CancelMyCustodyRequestDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRequestVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class StartCustodyRequestReviewDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRequestVersion!: number;
}

export class CompleteCustodyRequestDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRequestVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTargetVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionOnReturn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}

export class RejectCustodyRequestDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRequestVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  resolutionNote!: string;
}

export class SearchAssetCustodyRequestDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(AssetCustodyTargetType)
  targetType?: AssetCustodyTargetType;

  @IsOptional()
  @IsEnum(AssetCustodyRequestType)
  requestType?: AssetCustodyRequestType;

  @IsOptional()
  @IsEnum(AssetCustodyRequestStatus)
  status?: AssetCustodyRequestStatus;
}
