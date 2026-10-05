import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAttendanceRegularizationDto {
  @IsUUID()
  attendanceId: string;

  @IsOptional()
  @IsUUID()
  attendanceExceptionId?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckInAt?: string;

  @IsOptional()
  @IsDateString()
  proposedCheckOutAt?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ProcessAttendanceRegularizationDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AttendanceExceptionFilterDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateAttendancePeriodDto {
  @IsUUID()
  branchId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;
}

export class AttendancePeriodTransitionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ValidateIf((dto: AttendancePeriodTransitionDto) => Boolean(dto.reopenReason))
  @IsOptional()
  @IsString()
  reopenReason?: string;
}

export class AttendancePeriodFilterDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
