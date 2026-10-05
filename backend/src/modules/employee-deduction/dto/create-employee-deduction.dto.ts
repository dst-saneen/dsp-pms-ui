import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmployeeDeductionDto {
  @ApiProperty({
    example: 'company-uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    example: 'employee-uuid',
  })
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional({
    example: 'LOAN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deductionCode?: string;

  @ApiProperty({
    example: 'Laptop Loan Recovery',
  })
  @IsString()
  @MaxLength(200)
  deductionName: string;

  @ApiProperty({
    example: 5000,
  })
  @IsNumber()
  @Min(0.01)
  monthlyAmount: number;

  @ApiProperty({
    example: '2026-07-01',
  })
  @IsDateString()
  startMonth: string;

  @ApiPropertyOptional({
    example: '2027-04-30',
  })
  @IsOptional()
  @IsDateString()
  endMonth?: string;

  @ApiPropertyOptional({
    example: '10 month laptop recovery',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
