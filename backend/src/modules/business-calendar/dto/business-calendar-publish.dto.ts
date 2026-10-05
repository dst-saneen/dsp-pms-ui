import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublishCalendarVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optimisticVersion?: number;

  @ApiPropertyOptional({
    description:
      'Materialize runtime through this date (YYYY-MM-DD). Defaults to effectiveTo or +18 months.',
  })
  @IsOptional()
  @IsDateString()
  materializeTo?: string;

  @ApiPropertyOptional({
    description:
      'When publishing an amendment, preview-impact must have been reviewed.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  impactPreviewAcknowledged?: boolean;
}

export class StartAmendmentDto {
  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  effectiveDate!: string;

  @ApiProperty({ example: 'Correct Independence Day to full non-working' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class PreviewImpactDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RuntimeDayQueryDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  date!: string;
}

export class RuntimeRangeQueryDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  to!: string;
}

export class RuntimePreviewDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description:
      'Preview using this company calendar version (draft or published)',
  })
  @IsOptional()
  @IsUUID()
  companyVersionId?: string;

  @ApiPropertyOptional({
    description:
      'Preview using this branch calendar version (draft or published)',
  })
  @IsOptional()
  @IsUUID()
  branchVersionId?: string;
}

export class RuntimeRebuildDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  to!: string;
}

export class BackfillExpectedCountsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  companies!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  branches!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  workingDays!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  holidays!: number;
}

export class MigrationBackfillDto {
  @ApiProperty({ type: BackfillExpectedCountsDto })
  @ValidateNested()
  @Type(() => BackfillExpectedCountsDto)
  expected!: BackfillExpectedCountsDto;

  @ApiProperty({
    description:
      'Explicit calendar year used for migration draft effective dates',
    minimum: 2000,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  effectiveYear!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  apply?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowProduction?: boolean;
}

export class MigrationShadowCompareDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowDraftVersions?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  activateShadow?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowProduction?: boolean;
}

export class SetOfficeRuntimeModeDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ enum: ['LEGACY', 'SHADOW', 'ACTIVE'] })
  @IsIn(['LEGACY', 'SHADOW', 'ACTIVE'])
  mode!: 'LEGACY' | 'SHADOW' | 'ACTIVE';
}
