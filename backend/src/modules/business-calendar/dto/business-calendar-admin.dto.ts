import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProvisionCompanyCalendarDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty({ example: 'MAIN' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  calendarCode!: string;

  @ApiProperty({ example: 'Company Calendar' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  calendarName!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  defaultTimezone!: string;
}

export class ProvisionBranchCalendarDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({
    description: 'Defaults to BRANCH-<branchCode> when omitted',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  calendarCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  calendarName?: string;
}

export class UpdateBusinessCalendarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  calendarName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  defaultTimezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class EnsureOfficeCalendarsDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  defaultTimezone?: string;
}

export class ListBusinessCalendarsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
