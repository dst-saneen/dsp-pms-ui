import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateTaskContributionDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  contributionId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
