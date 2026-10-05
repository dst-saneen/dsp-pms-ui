import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePayrollRunDto {
  @ApiProperty({
    example: 'company-uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    example: 2026,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  payrollYear: number;

  @ApiProperty({
    example: 7,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  payrollMonth: number;

  @ApiPropertyOptional({
    example: 'July payroll run',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
