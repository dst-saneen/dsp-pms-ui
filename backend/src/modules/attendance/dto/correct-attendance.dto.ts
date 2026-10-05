import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ATTENDANCE_STATUSES } from '../constants';

export class CorrectAttendanceDto {
  @IsOptional()
  @IsDateString()
  checkInTime?: string;

  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @IsOptional()
  @IsIn([...ATTENDANCE_STATUSES])
  status?: string;

  @IsString()
  @MinLength(1)
  correctionReason!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
