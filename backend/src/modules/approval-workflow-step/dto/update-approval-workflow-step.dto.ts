import { PartialType } from '@nestjs/swagger';
import { CreateApprovalWorkflowStepDto } from './create-approval-workflow-step.dto';

export class UpdateApprovalWorkflowStepDto extends PartialType(
  CreateApprovalWorkflowStepDto,
) {}
