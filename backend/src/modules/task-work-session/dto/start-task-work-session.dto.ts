import { RuntimeClientType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartTaskWorkSessionDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  workScheduleItemId: string;

  @IsOptional()
  @IsEnum(RuntimeClientType)
  startedFrom?: RuntimeClientType;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
