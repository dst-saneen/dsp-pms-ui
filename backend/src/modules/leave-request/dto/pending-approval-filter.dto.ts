import { IsOptional, IsUUID } from 'class-validator';

export class PendingApprovalFilterDto {
  @IsUUID()
  approverId: string;

  @IsOptional()
  entityType?: string;
}
