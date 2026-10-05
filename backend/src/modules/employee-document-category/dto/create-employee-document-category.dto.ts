import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmployeeDocumentCategoryDto {
  @IsString()
  companyId: string;

  @IsString()
  categoryCode: string;

  @IsString()
  categoryName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
