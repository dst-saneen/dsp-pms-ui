import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class CreateEmployeeShiftDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  shiftId: string;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
