import { Module } from '@nestjs/common';

import { ApprovalWorkflowController } from './approval-workflow.controller';
import { ApprovalWorkflowService } from './approval-workflow.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ApprovalWorkflowController],
  providers: [ApprovalWorkflowService],
})
export class ApprovalWorkflowModule {}
