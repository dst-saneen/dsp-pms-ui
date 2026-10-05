import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { CreateJobOpeningDto } from './create-job-opening.dto';

export class UpdateJobOpeningDto extends PartialType(CreateJobOpeningDto) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;
}
