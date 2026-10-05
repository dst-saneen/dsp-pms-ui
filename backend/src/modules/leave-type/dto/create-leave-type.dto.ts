import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveTypeCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({
    description:
      'Optional. When omitted, generated from leaveName (e.g. Casual Leave → CL).',
  })
  @IsOptional()
  @IsString()
  leaveCode?: string;

  @ApiProperty()
  @IsString()
  leaveName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: LeaveTypeCategory,
    description:
      'STANDARD = normal leave. COMP_OFF = spends overtime comp-off credits. UNPAID = unpaid leave. OPTIONAL_HOLIDAY = floating holiday selection (forced paid, no half-day; requiresApproval is company choice).',
  })
  @IsOptional()
  @IsEnum(LeaveTypeCategory)
  category?: LeaveTypeCategory;

  @ApiProperty()
  @IsBoolean()
  isPaid: boolean;

  @ApiProperty()
  @IsBoolean()
  requiresApproval: boolean;

  @ApiProperty()
  @IsBoolean()
  allowHalfDay: boolean;

  @ApiProperty()
  @IsBoolean()
  carryForwardAllowed: boolean;
}
