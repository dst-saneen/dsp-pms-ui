import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AssetClearanceWaiverReasonCode,
  AssetClearanceWaiverStatus,
} from '@prisma/client';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';
import { OperationCommandDto } from './operation-command.dto';

export class RequestAssetClearanceWaiverDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedClearanceItemVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTargetVersion!: number;

  @IsEnum(AssetClearanceWaiverReasonCode)
  reasonCode!: AssetClearanceWaiverReasonCode;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  evidenceReference?: string;
}

export class ApproveAssetClearanceWaiverDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedWaiverVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedClearanceItemVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedTargetVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionNote?: string;
}

export class RejectAssetClearanceWaiverDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedWaiverVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedClearanceItemVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  decisionNote!: string;
}

export class CancelAssetClearanceWaiverDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedWaiverVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedClearanceItemVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class SearchAssetClearanceWaiverDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(AssetClearanceWaiverStatus)
  status?: AssetClearanceWaiverStatus;
}
