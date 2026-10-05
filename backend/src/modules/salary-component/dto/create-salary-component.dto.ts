import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSalaryComponentDto {
  @ApiProperty({
    example: 'company-uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    example: 'BASIC',
  })
  @IsString()
  @MaxLength(50)
  componentCode: string;

  @ApiProperty({
    example: 'Basic Salary',
  })
  @IsString()
  @MaxLength(200)
  componentName: string;

  @ApiProperty({
    example: 'EARNING',
  })
  @IsString()
  @MaxLength(50)
  componentType: string;

  @ApiPropertyOptional({
    example: 'Monthly basic salary',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
