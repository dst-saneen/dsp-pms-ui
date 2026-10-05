import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { ContributionCategory } from '@prisma/client';

export class CreateContributionDto {
  @IsUUID()
  onboardingDepartmentTemplateId: string;

  @IsString()
  @MaxLength(50)
  contributionCode: string;

  @IsString()
  @MaxLength(200)
  contributionName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ContributionCategory)
  category: ContributionCategory;

  @IsOptional()
  @IsUUID()
  businessCapabilityId?: string;

  @IsOptional()
  @IsString()
  businessCapabilityCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
