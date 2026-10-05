import { FinanceCategoryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';
import { VersionedCommandDto } from './versioned-command.dto';

export class SearchFinanceCategoryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(FinanceCategoryType)
  categoryType?: FinanceCategoryType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class CreateFinanceCategoryDto extends OperationCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  categoryName!: string;

  @IsEnum(FinanceCategoryType)
  categoryType!: FinanceCategoryType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateFinanceCategoryDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
