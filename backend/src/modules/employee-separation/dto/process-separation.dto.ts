import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProcessSeparationDto {
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @IsString()
  @MaxLength(160)
  operationId: string;

  /** Required (≥3) when rejecting; optional remarks when approving. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4_000)
  remarks?: string;
}
