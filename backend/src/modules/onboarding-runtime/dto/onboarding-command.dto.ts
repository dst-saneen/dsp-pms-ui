import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StartEmployeeOnboardingDto {
  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ example: '2026-08-18' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  /** Rejected on the normal runtime start path. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class OverrideStartEmployeeOnboardingDto extends StartEmployeeOnboardingDto {
  @ApiProperty()
  @IsUUID()
  declare templateId: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CompleteEmployeeOnboardingDto {
  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedOnboardingVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelEmployeeOnboardingDto {
  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedOnboardingVersion!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
