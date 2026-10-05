import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateOnboardingTaskGroupDto {
  @IsUUID()
  onboardingDepartmentTemplateId: string;

  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsString()
  groupName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  displayOrder: number;

  @IsBoolean()
  isMandatory: boolean;
}
