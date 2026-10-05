import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OvertimeRequestStatus, OvertimeSettlementType } from '@prisma/client';

export class OvertimeRequestFilterDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(OvertimeRequestStatus)
  status?: OvertimeRequestStatus;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class SubmitOvertimeRequestDto {
  @IsEnum(OvertimeSettlementType)
  requestedSettlement!: OvertimeSettlementType;

  @IsInt()
  @Min(1)
  requestedMinutes!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveOvertimeRequestDto {
  @IsInt()
  @Min(0)
  approvedMinutes!: number;

  @IsEnum(OvertimeSettlementType)
  approvedSettlement!: OvertimeSettlementType;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class RejectOvertimeRequestDto {
  @IsString()
  @IsNotEmpty()
  remarks!: string;
}

export class CancelOvertimeRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateOvertimePolicyDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumEligibleMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roundingMinutes?: number;

  @IsOptional()
  includeEarlyArrival?: boolean;

  @IsOptional()
  requireScheduledMinutesFulfilled?: boolean;

  @IsOptional()
  allowCompOff?: boolean;

  @IsOptional()
  allowPayrollPending?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compOffHalfDayMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compOffFullDayMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1)
  maxCompOffDaysPerSource?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compOffExpiryDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDailyMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMonthlyMinutes?: number;

  @IsOptional()
  requiresApproval?: boolean;
}

export class UpdateOvertimePolicyDto {
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumEligibleMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roundingMinutes?: number;

  @IsOptional()
  includeEarlyArrival?: boolean;

  @IsOptional()
  requireScheduledMinutesFulfilled?: boolean;

  @IsOptional()
  allowCompOff?: boolean;

  @IsOptional()
  allowPayrollPending?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compOffHalfDayMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compOffFullDayMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1)
  maxCompOffDaysPerSource?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compOffExpiryDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDailyMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMonthlyMinutes?: number | null;

  @IsOptional()
  requiresApproval?: boolean;

  @IsOptional()
  isActive?: boolean;
}

export class OvertimePolicyFilterDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
