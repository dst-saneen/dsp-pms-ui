import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWorkScheduleItemDto {
  @IsUUID()
  workScheduleId: string;

  @IsUUID()
  employeeId: string;

  @IsDateString()
  workDate: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  workCategoryId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  plannedHours: number;
}
