import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InterviewMode } from '@prisma/client';

export class PanelMemberDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLead?: boolean;
}

export class ScheduleInterviewDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  roundNumber: number;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  roundName: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty()
  @IsDateString()
  scheduledStartAt: string;

  @ApiProperty()
  @IsDateString()
  scheduledEndAt: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  timezone: string;

  @ApiProperty({ enum: InterviewMode })
  @IsEnum(InterviewMode)
  mode: InterviewMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationOrLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  evaluationDeadlineAt?: string;

  @ApiProperty({ type: [PanelMemberDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PanelMemberDto)
  panelMembers: PanelMemberDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  applicationVersion?: number;
}

export class RescheduleInterviewDto {
  @ApiProperty()
  @IsDateString()
  scheduledStartAt: string;

  @ApiProperty()
  @IsDateString()
  scheduledEndAt: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  timezone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationOrLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  evaluationDeadlineAt?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class CancelInterviewDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
