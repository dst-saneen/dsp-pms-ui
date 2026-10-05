import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateEmployeeSalaryLineDto } from './create-employee-salary-line.dto';

export class CreateEmployeeSalaryDto {
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

  @ApiProperty({
    example: '2026-07-01',
  })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({
    example: 'Initial salary package',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    type: [CreateEmployeeSalaryLineDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeSalaryLineDto)
  lines: CreateEmployeeSalaryLineDto[];
}
