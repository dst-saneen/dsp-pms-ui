import { PartialType } from '@nestjs/swagger';
import { CreateApprovalTransactionStepDto } from './create-approval-transaction-step.dto';

export class UpdateApprovalTransactionStepDto extends PartialType(
  CreateApprovalTransactionStepDto,
) {}
