import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';
import { OperationCommandDto } from './operation-command.dto';

export class SearchDepartmentAssetGrantDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class CreateDepartmentAssetGrantDto extends OperationCommandDto {
  @IsUUID()
  departmentId!: string;

  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class VersionedDepartmentAssetGrantDto extends OperationCommandDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
