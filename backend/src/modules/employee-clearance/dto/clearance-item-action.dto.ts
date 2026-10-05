import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ClearanceItemActionDto {
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @IsString()
  @MaxLength(160)
  operationId: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4_000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4_000)
  remarks?: string;
}
