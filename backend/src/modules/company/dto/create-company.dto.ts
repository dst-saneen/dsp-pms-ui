import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsString,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyGroupId?: string;

  @ApiProperty()
  @IsString()
  companyName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 legal country of the Company.',
    example: 'IN',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'legalCountryCode must be a two-letter ISO country code.',
  })
  legalCountryCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
