import { PartialType } from '@nestjs/swagger';

import { CreateApprovalWorkflowDto } from './create-approval-workflow.dto';

export class UpdateApprovalWorkflowDto extends PartialType(
  CreateApprovalWorkflowDto,
) {}
