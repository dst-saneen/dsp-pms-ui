import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CompensationPeriod } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reportingManagerEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compensationAmount?: number;

  @ApiPropertyOptional({
    description:
      'Optional confirmation of the Company Financial Profile currency. A different currency is rejected.',
    example: 'AED',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  compensationCurrency?: string;

  @ApiPropertyOptional({
    enum: CompensationPeriod,
    default: CompensationPeriod.MONTHLY,
  })
  @IsOptional()
  @IsEnum(CompensationPeriod)
  compensationPeriod?: CompensationPeriod;

  @ApiPropertyOptional({ default: 90 })
  @IsOptional()
  @IsInt()
  @Min(0)
  probationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  termsText?: string;
}

export class UpdateOfferDraftDto extends CreateOfferDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  version?: number;
}

export class ReviseOfferDto extends CreateOfferDraftDto {}

export class SendOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNote?: string;
}
