import { IsNumber, IsOptional, IsString } from 'class-validator';
import { WorkExecutionStatus } from '@prisma/client';

export class UpdateWorkScheduleItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  plannedHours?: number;

  @IsOptional()
  @IsString()
  status?: WorkExecutionStatus;
}
