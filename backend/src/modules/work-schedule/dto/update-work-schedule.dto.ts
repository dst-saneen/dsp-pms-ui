import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateWorkScheduleDto {
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsDateString()
  weekEndDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
