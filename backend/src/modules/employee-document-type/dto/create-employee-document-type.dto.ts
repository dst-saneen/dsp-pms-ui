import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmployeeDocumentTypeDto {
  @IsString()
  companyId: string;

  @IsString()
  categoryId: string;

  @IsString()
  @MaxLength(50)
  documentCode: string;

  @IsString()
  @MaxLength(100)
  documentName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  requiresExpiry?: boolean = false;

  @IsOptional()
  @IsBoolean()
  requiresDocumentNumber?: boolean = false;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean = false;

  @IsOptional()
  @IsBoolean()
  lifetimeAllowed?: boolean = true;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean = false;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
