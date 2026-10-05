import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeavePolicyDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Omit or null for a company-wide default. Department and designation require a branch.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @ApiProperty()
  @IsUUID()
  leaveTypeId: string;

  @ApiProperty({ minimum: 0.01, maximum: 400 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(400)
  annualEntitlement: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carryForwardLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxConsecutiveDays?: number;

  @ApiProperty()
  @IsBoolean()
  allowNegativeBalance: boolean;
}
