import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmployeeTaxProfileDto {
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
    example: 'INDIA',
  })
  @IsString()
  @MaxLength(50)
  countryCode: string;

  @ApiPropertyOptional({
    example: 'NEW',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxRegime?: string;

  @ApiPropertyOptional({
    example: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyTaxAmount?: number;
}
