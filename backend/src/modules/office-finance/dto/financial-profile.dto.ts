import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import { VersionedCommandDto } from './versioned-command.dto';

export class UpdateFinancialProfileDto extends VersionedCommandDto {
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  baseCurrencyCode!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  reportingStartDate!: string;

  @IsOptional()
  @IsUUID('4')
  payrollExpenseCategoryId?: string | null;
}
