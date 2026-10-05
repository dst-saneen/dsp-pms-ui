import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class JobOpeningTransitionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;
}
