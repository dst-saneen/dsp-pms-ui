import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AddDesignationDepartmentDto {
  @ApiProperty()
  @IsUUID()
  departmentId!: string;

  /** When set, must match the department's Branch (W0-06). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
