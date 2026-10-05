import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Update Designation core fields + optional home Department.
 * When `onboardingDepartmentIds` is provided, involvement departments are
 * synced atomically in the same transaction (ONB-002 / W0-05 edit path).
 * Omitted `onboardingDepartmentIds` leaves existing links unchanged.
 * Omitted `departmentId` preserves existing value; explicit `null` clears it.
 */
export class UpdateDesignationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  departmentId?: string | null;

  /** Required when onboardingDepartmentIds is non-empty. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /**
   * Desired onboarding involvement set. When present (including `[]`),
   * replaces the current links atomically.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  onboardingDepartmentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationId?: string;
}
