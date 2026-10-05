import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateShiftRosterDto {
  @IsUUID()
  branchId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;
}

export class UpdateShiftRosterDto {
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}

export class GenerateShiftRosterDto {
  @IsUUID()
  branchId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsUUID()
  shiftRosterId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;
}

export class ShiftRosterTransitionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class CreateShiftRosterOverrideDto extends ShiftRosterTransitionDto {
  @IsUUID()
  shiftRosterEntryId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsObject()
  newSnapshot: {
    shiftId?: string | null;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    breakMinutes?: number;
    scheduledNetMinutes?: number;
    dayType?: string;
    dayPortion?: string;
  };
}

export class ShiftRosterFilterDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  status?: string;
}
