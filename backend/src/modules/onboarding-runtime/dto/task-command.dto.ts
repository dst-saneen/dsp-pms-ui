import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OnboardingTaskCommandDto {
  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedTaskVersion!: number;
}

export class AssignOnboardingTaskDto extends OnboardingTaskCommandDto {
  @ApiProperty()
  @IsUUID()
  assigneeEmployeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class UnassignOnboardingTaskDto extends OnboardingTaskCommandDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class StartOnboardingTaskCommandDto extends OnboardingTaskCommandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class CompleteOnboardingTaskCommandDto extends OnboardingTaskCommandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  overrideReason?: string;
}

export class SkipOnboardingTaskCommandDto extends OnboardingTaskCommandDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReopenDependentVersionDto {
  @ApiProperty()
  @IsUUID()
  taskId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReopenOnboardingTaskCommandDto extends OnboardingTaskCommandDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ type: [ReopenDependentVersionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReopenDependentVersionDto)
  dependentTaskVersions?: ReopenDependentVersionDto[];
}

export class FulfillOnboardingAssetTaskDto extends OnboardingTaskCommandDto {
  @ApiProperty()
  @IsUUID()
  assetId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedAssetVersion!: number;

  @ApiProperty()
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class WaiveOnboardingTaskDto extends OnboardingTaskCommandDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
