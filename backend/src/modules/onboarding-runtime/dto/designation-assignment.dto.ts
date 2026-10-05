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

import { SearchQueryDto } from '../../../common/dto';

export class WriteDesignationOnboardingAssignmentDto {
  @ApiProperty()
  @IsUUID()
  designationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty()
  @IsUUID()
  onboardingTemplateId!: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiProperty()
  @IsUUID()
  operationId!: string;
}

export class DeactivateDesignationOnboardingAssignmentDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class DesignationOnboardingAssignmentQueryDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  onboardingTemplateId?: string;
}
