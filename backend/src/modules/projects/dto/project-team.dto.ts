import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AddProjectTeamMemberDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role!: string;

  @IsOptional()
  @IsNumberString()
  allocationPercentage?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class UpdateProjectTeamMemberDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;

  @IsOptional()
  @IsNumberString()
  allocationPercentage?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

export class EndProjectTeamMemberDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
