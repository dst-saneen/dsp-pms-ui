import { Module } from '@nestjs/common';

import { ApprovalTransactionStepController } from './approval-transaction-step.controller';
import { ApprovalTransactionStepService } from './approval-transaction-step.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ApprovalTransactionStepController],
  providers: [ApprovalTransactionStepService],
  exports: [ApprovalTransactionStepService],
})
export class ApprovalTransactionStepModule {}
