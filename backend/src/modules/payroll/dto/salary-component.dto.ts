import { SalaryComponentType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/search-query.dto';

import { OperationCommandDto } from './operation-command.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from './versioned-command.dto';

export class SearchSalaryComponentDto extends SearchQueryDto {}

export class CreateSalaryComponentDto extends OperationCommandDto {
  /** Optional. When omitted, a code is generated from the component name. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  componentCode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  componentName!: string;

  @IsEnum(SalaryComponentType)
  componentType!: SalaryComponentType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSalaryComponentDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  componentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ArchiveSalaryComponentDto extends VersionedReasonCommandDto {}
