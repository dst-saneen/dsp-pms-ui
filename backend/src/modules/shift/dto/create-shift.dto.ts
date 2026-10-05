import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  companyId: string;

  @IsString()
  shiftName: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceInMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceOutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isNightShift?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
