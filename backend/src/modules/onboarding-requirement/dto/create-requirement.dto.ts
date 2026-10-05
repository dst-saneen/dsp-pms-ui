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

import { RequirementType, ReferenceType } from '@prisma/client';

export class CreateRequirementDto {
  @IsUUID()
  contributionId: string;

  @IsEnum(RequirementType)
  requirementType: RequirementType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requirementCode?: string;

  @IsString()
  @MaxLength(200)
  requirementName: string;

  @IsOptional()
  @IsString()
  requirementValue?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ReferenceType)
  referenceType?: ReferenceType;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsUUID()
  dependsOnRequirementId?: string;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsString()
  validationRule?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
