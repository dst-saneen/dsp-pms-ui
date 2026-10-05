import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateOnboardingDepartmentTemplateDto {
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsInt()
  @Min(1)
  expectedVersion: number;
}
