import { IsOptional, IsString, IsUUID } from 'class-validator';

export class LeaveRequestFilterDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
