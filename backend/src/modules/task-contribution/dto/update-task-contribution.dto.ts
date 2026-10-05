import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateTaskContributionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
