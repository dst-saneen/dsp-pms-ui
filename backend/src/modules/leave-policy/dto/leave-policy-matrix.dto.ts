import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeavePolicyMatrixQueryDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class LeavePolicyMatrixCellDto {
  @ApiProperty()
  @IsUUID()
  designationId!: string;

  @ApiProperty()
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @ValidateIf((cell: LeavePolicyMatrixCellDto) => cell.enabled)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(400)
  annualEntitlement?: number;
}

export class ReplaceLeavePolicyMatrixDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  snapshotToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ type: [LeavePolicyMatrixCellDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LeavePolicyMatrixCellDto)
  cells!: LeavePolicyMatrixCellDto[];
}
