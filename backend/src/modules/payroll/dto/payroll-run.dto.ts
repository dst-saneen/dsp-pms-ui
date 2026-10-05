import { PayrollAdjustmentDirection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

import { OperationCommandDto } from './operation-command.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from './versioned-command.dto';

export class PreflightQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class SearchPayrollRunDto extends SearchQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreatePayrollRunDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class CreatePayrollAdjustmentDto extends VersionedCommandDto {
  @IsUUID('4')
  employeeId!: string;

  @IsEnum(PayrollAdjustmentDirection)
  direction!: PayrollAdjustmentDirection;

  @IsIn(['MANUAL_ADJUSTMENT', 'OVERTIME', 'UNPAID_LEAVE'])
  sourceType!: 'MANUAL_ADJUSTMENT' | 'OVERTIME' | 'UNPAID_LEAVE';

  @IsOptional()
  @IsUUID('4')
  sourceId?: string;

  @IsString()
  @MinLength(1)
  amount!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class UpdatePayrollAdjustmentDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  amount?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}

export class MarkPayrollPaidDto extends VersionedCommandDto {
  @IsUUID('4')
  paymentAccountId!: string;

  @IsString()
  paidDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  paymentReference!: string;
}

export class CancelPayrollRunDto extends VersionedReasonCommandDto {}

export class ReturnPayrollToDraftDto extends VersionedReasonCommandDto {}

export class CalculatePayrollRunDto extends VersionedCommandDto {}

export class ApprovePayrollRunDto extends VersionedCommandDto {}

export class RemovePayrollAdjustmentDto extends VersionedCommandDto {}
