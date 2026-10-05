import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** Versioned command body for Projects mutations. */
export class ProjectCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
