import { Module } from '@nestjs/common';

import { ApprovalWorkflowStepController } from './approval-workflow-step.controller';
import { ApprovalWorkflowStepService } from './approval-workflow-step.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ApprovalWorkflowStepController],
  providers: [ApprovalWorkflowStepService],
})
export class ApprovalWorkflowStepModule {}
