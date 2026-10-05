import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AssignResourceDto {
  @ApiProperty({
    example: 'company-uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    example: 'employee-uuid',
  })
  @IsUUID()
  employeeId: string;

  @ApiProperty({
    example: 'resource-uuid',
  })
  @IsUUID()
  resourceId: string;

  @ApiProperty({
    example: '2026-06-24',
  })
  @IsDateString()
  assignedDate: string;

  @ApiPropertyOptional({
    example: 'Assigned during onboarding',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
