import { IsOptional, IsUUID } from 'class-validator';

export class LeaveTypeFilterDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
