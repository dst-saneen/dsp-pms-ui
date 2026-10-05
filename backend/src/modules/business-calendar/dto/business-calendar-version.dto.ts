import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BusinessCalendarRuleMode,
  BusinessDayEffect,
  CalendarEventTargetType,
  CalendarSourceKind,
  DayPortion,
} from '@prisma/client';

export class CreateCalendarVersionDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;
}

export class UpdateCalendarVersionDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;

  @ApiPropertyOptional({ description: 'Optimistic concurrency token' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optimisticVersion?: number;
}

export class WorkingWeekRuleDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ enum: BusinessCalendarRuleMode })
  @IsEnum(BusinessCalendarRuleMode)
  ruleMode!: BusinessCalendarRuleMode;

  @ApiProperty()
  @IsBoolean()
  isWorkingDay!: boolean;

  @ApiPropertyOptional({ enum: DayPortion, default: DayPortion.FULL_DAY })
  @IsOptional()
  @IsEnum(DayPortion)
  dayPortion?: DayPortion;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReplaceWorkingWeekDto {
  @ApiProperty({ type: [WorkingWeekRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingWeekRuleDto)
  rules!: WorkingWeekRuleDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optimisticVersion?: number;
}

export class VersionTransitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optimisticVersion?: number;
}

export class EventTargetDto {
  @ApiProperty({ enum: CalendarEventTargetType })
  @IsEnum(CalendarEventTargetType)
  targetType!: CalendarEventTargetType;

  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class CreateBusinessCalendarEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  eventTypeId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  eventCategoryId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  eventSourceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  eventCode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  eventName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsBoolean()
  allDay!: boolean;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventTimezone?: string;

  @ApiPropertyOptional({
    enum: BusinessDayEffect,
    default: BusinessDayEffect.NONE,
  })
  @IsOptional()
  @IsEnum(BusinessDayEffect)
  businessDayEffect?: BusinessDayEffect;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  paidHoliday?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Optional/floating holiday: office stays open; employees may select this day within company holiday allowance.',
  })
  @IsOptional()
  @IsBoolean()
  isOptionalHoliday?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;

  @ApiProperty({ type: [EventTargetDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EventTargetDto)
  targets!: EventTargetDto[];
}

export class UpdateBusinessCalendarEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  eventTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  eventCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  eventSourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  eventCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  eventName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventTimezone?: string | null;

  @ApiPropertyOptional({ enum: BusinessDayEffect })
  @IsOptional()
  @IsEnum(BusinessDayEffect)
  businessDayEffect?: BusinessDayEffect;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paidHoliday?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOptionalHoliday?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;

  @ApiPropertyOptional({ type: [EventTargetDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EventTargetDto)
  targets?: EventTargetDto[];
}

export class CreateEventTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  eventTypeCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  eventTypeName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsBusinessDayEffect?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  iconKey?: string;
}

export class UpdateEventTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  eventTypeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowsBusinessDayEffect?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  iconKey?: string | null;
}

export class CreateEventCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  categoryCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  categoryName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string;
}

export class UpdateEventCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  categoryName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string | null;
}

export class CreateEventSourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/)
  sourceCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  sourceName!: string;

  @ApiProperty({ enum: CalendarSourceKind })
  @IsEnum(CalendarSourceKind)
  sourceKind!: CalendarSourceKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class UpdateEventSourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  sourceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class ListEventsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
