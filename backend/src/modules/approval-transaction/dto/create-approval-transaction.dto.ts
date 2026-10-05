import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateApprovalTransactionDto {
  @IsUUID()
  workflowId: string;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsUUID()
  requestedById?: string;
}
