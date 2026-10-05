import { Module } from '@nestjs/common';

import { ApprovalTransactionController } from './approval-transaction.controller';
import { ApprovalTransactionService } from './approval-transaction.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],

  controllers: [ApprovalTransactionController],

  providers: [ApprovalTransactionService],

  exports: [ApprovalTransactionService],
})
export class ApprovalTransactionModule {}
