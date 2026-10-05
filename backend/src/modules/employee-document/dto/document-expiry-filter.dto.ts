import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

export enum DocumentExpiryStatus {
  VALID = 'VALID',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  LIFETIME = 'LIFETIME',
}

export class DocumentExpiryFilterDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  documentTypeId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(DocumentExpiryStatus)
  expiryStatus?: DocumentExpiryStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiryWithinDays?: number = 30;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lifetimeDocument?: boolean;
}
