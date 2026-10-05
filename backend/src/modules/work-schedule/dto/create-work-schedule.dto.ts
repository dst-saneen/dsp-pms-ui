import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWorkScheduleDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  weekStartDate: string;

  @IsDateString()
  weekEndDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
