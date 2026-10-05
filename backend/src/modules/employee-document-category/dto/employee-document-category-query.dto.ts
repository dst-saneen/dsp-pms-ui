import { IsOptional, IsString } from 'class-validator';

export class EmployeeDocumentCategoryQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
