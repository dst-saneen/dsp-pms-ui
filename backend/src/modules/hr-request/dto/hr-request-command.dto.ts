import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class HrRequestVersionedCommandDto {
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @IsString()
  @MaxLength(160)
  operationId: string;
}

export class HrRequestReasonCommandDto extends HrRequestVersionedCommandDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(4_000)
  reason: string;
}

export class RejectHrRequestDto extends HrRequestVersionedCommandDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(4_000)
  reason: string;
}
