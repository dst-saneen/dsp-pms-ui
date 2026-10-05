import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApprovalWorkflowDto {
  @IsString()
  workflowCode: string;

  @IsString()
  workflowName: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
