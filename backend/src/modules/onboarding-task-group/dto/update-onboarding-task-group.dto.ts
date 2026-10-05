import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOnboardingTaskGroupDto {
  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsInt()
  @Min(1)
  expectedVersion: number;
}
