import { IsOptional, IsString, MaxLength } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteOnboardingTaskDto {
  @ApiPropertyOptional({
    example: 'Passport received',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
