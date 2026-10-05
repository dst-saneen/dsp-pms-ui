import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateImportBatchDto {
  @ApiProperty()
  @IsUUID()
  calendarVersionId!: string;

  @ApiPropertyOptional({
    description: 'Optional override; otherwise inferred from file extension',
  })
  @IsOptional()
  @IsIn(['CSV', 'EXCEL', 'ICS'])
  sourceKind?: 'CSV' | 'EXCEL' | 'ICS';
}

export class GovernmentImportDto {
  @ApiProperty()
  @IsUUID()
  calendarVersionId!: string;

  @ApiProperty({ example: 'IN' })
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @ApiPropertyOptional({ example: 'IN-KL' })
  @IsOptional()
  @IsString()
  subdivisionCode?: string;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

export class ReviewImportBatchDto {
  @ApiProperty({
    description: 'Row ids to apply; omitted rows are skipped',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  selectedRowIds!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  approve?: boolean;
}

export class ListImportBatchesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  calendarVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
