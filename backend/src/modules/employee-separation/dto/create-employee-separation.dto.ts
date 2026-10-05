import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const MANUAL_CLEARANCE_TYPES = ['HR', 'FINANCE', 'IT', 'ADMIN'] as const;

export type ManualClearanceType = (typeof MANUAL_CLEARANCE_TYPES)[number];

export class ClearanceDepartmentMappingDto {
  @IsIn(MANUAL_CLEARANCE_TYPES)
  clearanceType: ManualClearanceType;

  @IsUUID()
  executorDepartmentId: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  itemName?: string;
}

export class CreateEmployeeSeparationDto {
  @IsUUID()
  employeeId: string;

  @IsIn(['RESIGNATION', 'TERMINATION', 'RETIREMENT'])
  @MaxLength(40)
  separationType: string;

  @IsOptional()
  @IsDateString()
  resignationDate?: string;

  @IsDateString()
  lastWorkingDate: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(4_000)
  reason: string;

  @IsString()
  @MaxLength(160)
  operationId: string;

  /**
   * Explicit Department ownership is mandatory for every manual clearance
   * stream. Asset clearance is deliberately excluded: the Asset domain owns it.
   */
  @IsArray()
  @ArrayMinSize(MANUAL_CLEARANCE_TYPES.length)
  @ValidateNested({ each: true })
  @Type(() => ClearanceDepartmentMappingDto)
  clearanceDepartments: ClearanceDepartmentMappingDto[];
}
