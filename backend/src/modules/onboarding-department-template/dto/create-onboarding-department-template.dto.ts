import { IsBoolean, IsInt, IsUUID } from 'class-validator';

export class CreateOnboardingDepartmentTemplateDto {
  @IsUUID()
  onboardingTemplateVersionId: string;

  @IsUUID()
  departmentId: string;

  @IsInt()
  displayOrder: number;

  @IsBoolean()
  isRequired: boolean;
}
