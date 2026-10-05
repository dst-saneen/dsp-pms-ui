import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeOnboardingDto {
  @ApiProperty({
    example: 'employee-uuid',
  })
  @IsUUID()
  employeeId: string;

  @ApiProperty({
    example: 'template-uuid',
  })
  @IsUUID()
  templateId: string;

  @ApiProperty({
    example: '2026-06-24',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: 'Joining as Senior Architect',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
