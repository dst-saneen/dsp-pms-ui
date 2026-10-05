import { IsUUID, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  attendanceDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
