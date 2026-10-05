import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CompleteSeparationDto {
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @IsString()
  @MaxLength(160)
  operationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  clearanceRemarks?: string;
}
