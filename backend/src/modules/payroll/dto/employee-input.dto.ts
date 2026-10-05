import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from './versioned-command.dto';

export class SalaryRevisionLineDto {
  @IsUUID('4')
  salaryComponentId!: string;

  @IsString()
  @MinLength(1)
  amount!: string;
}

export class CreateSalaryRevisionDto extends OperationCommandDto {
  @IsString()
  effectiveFrom!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalaryRevisionLineDto)
  lines!: SalaryRevisionLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedCurrentRevisionVersion?: number;
}

export class EndSalaryRevisionDto extends VersionedCommandDto {
  @IsString()
  effectiveTo!: string;
}

export class CreateTaxProfileDto extends OperationCommandDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxRegime?: string;

  @IsString()
  monthlyTaxAmount!: string;

  @IsString()
  effectiveFrom!: string;
}

export class EndTaxProfileDto extends VersionedCommandDto {
  @IsString()
  effectiveTo!: string;
}

export class CreateEmployeeDeductionDto extends OperationCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  deductionCode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  deductionName!: string;

  @IsString()
  monthlyAmount!: string;

  @IsString()
  startMonth!: string;

  @IsOptional()
  @IsString()
  endMonth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class UpdateEmployeeDeductionDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  deductionName?: string;

  @IsOptional()
  @IsString()
  monthlyAmount?: string;

  @IsOptional()
  @IsString()
  endMonth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class ArchiveEmployeeDeductionDto extends VersionedReasonCommandDto {}
