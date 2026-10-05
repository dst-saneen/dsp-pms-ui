import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  ValidateIf,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDesignationDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  designationName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Optional home Department (DesignationHomeDepartment). Omitted → NULL. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  departmentId?: string | null;

  /** Required when onboardingDepartmentIds is non-empty (W0-06). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Optional onboarding involvement departments — linked atomically (W0-05). */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  onboardingDepartmentIds?: string[];

  /** Client idempotency key for safe retries of the composite create. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationId?: string;
}
