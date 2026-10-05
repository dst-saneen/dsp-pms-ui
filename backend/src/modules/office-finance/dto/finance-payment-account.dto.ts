import { FinanceAccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';
import { VersionedCommandDto } from './versioned-command.dto';

export class SearchFinancePaymentAccountDto {
  @IsOptional()
  @IsString()
  keyword?: string;

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

export class CreateFinancePaymentAccountDto extends OperationCommandDto {
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  accountName!: string;

  @IsEnum(FinanceAccountType)
  accountType!: FinanceAccountType;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  openingBalance!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  openingDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankReferenceWrite?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankReference?: string;
}

export class UpdateFinancePaymentAccountDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  accountName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  openingBalance?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  openingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankReferenceWrite?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankReference?: string;
}
