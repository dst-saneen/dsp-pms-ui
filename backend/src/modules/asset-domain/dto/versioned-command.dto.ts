import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class VersionedCommandDto extends OperationCommandDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class VersionedReasonCommandDto extends VersionedCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class VersionedEffectiveDateCommandDto extends VersionedReasonCommandDto {
  /** Calendar date in YYYY-MM-DD (validated further by repository parser). */
  @IsString()
  effectiveDate!: string;
}
