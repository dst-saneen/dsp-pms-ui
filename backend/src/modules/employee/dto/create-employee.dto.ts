import {
  IsBoolean,
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsIn,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsUUID()
  departmentId: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  joiningDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeType?: string;

  @ApiPropertyOptional({
    description:
      'ACTIVE | PROBATION | PENDING_ONBOARDING | NOTICE | TERMINATED | RESIGNED',
  })
  @IsOptional()
  @IsIn([
    'ACTIVE',
    'PROBATION',
    'PENDING_ONBOARDING',
    'NOTICE',
    'TERMINATED',
    'RESIGNED',
  ])
  employmentStatus?: string;

  @ApiPropertyOptional({
    description:
      'Optional reason when recording a direct / already-hired employee.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  creationReason?: string;

  @ApiPropertyOptional({
    description: 'External reference for creation audit traceability.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  externalReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
