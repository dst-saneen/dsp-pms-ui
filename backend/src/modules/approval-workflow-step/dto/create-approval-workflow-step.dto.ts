import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApprovalWorkflowStepDto {
  @IsUUID()
  workflowId: string;

  @IsInt()
  stepNo: number;

  @IsString()
  approverType: string;

  @IsOptional()
  @IsString()
  approverRole?: string;
}
