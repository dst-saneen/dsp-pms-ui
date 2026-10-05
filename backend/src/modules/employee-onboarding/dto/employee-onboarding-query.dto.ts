import { IsEnum, IsOptional, IsString } from 'class-validator';

import { SearchQueryDto } from '../../../common/dto';
import { TaskStatus } from '@prisma/client';

export class EmployeeOnboardingQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
