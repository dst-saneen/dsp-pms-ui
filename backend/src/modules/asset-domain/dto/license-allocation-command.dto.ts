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
} from 'class-validator';
import { LicenseAllocationStatus } from '@prisma/client';

import { OperationCommandDto } from './operation-command.dto';
import { SearchQueryDto } from '../../../common/dto/search-query.dto';

export class AllocateLicenseCommandDto extends OperationCommandDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  allocatedDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedPoolVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class RevokeLicenseCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAllocationVersion!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedPoolVersion?: number;

  @IsDateString()
  revokedDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class SearchEmployeeAssetDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  custodyStatus?: string;
}

export class SearchLicenseAllocationDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(LicenseAllocationStatus)
  status?: LicenseAllocationStatus;
}
