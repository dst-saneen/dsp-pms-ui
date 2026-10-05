import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CancelSeparationDto {
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @IsString()
  @MaxLength(160)
  operationId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(4_000)
  reason: string;
}
