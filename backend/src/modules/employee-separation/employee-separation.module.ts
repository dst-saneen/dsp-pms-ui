import { Module } from '@nestjs/common';

import { EmployeeSeparationController } from './employee-separation.controller';
import { EmployeeSeparationService } from './employee-separation.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeeClearanceModule } from '../employee-clearance/employee-clearance.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WorkforceApprovalModule } from '../workforce-approval/workforce-approval.module';
import { HrOperationsCommandReceiptService } from '../hr-operations/hr-operations-command-receipt.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OutboxModule,
    WorkforceApprovalModule,
    EmployeeClearanceModule,
  ],
  controllers: [EmployeeSeparationController],
  providers: [EmployeeSeparationService, HrOperationsCommandReceiptService],
})
export class EmployeeSeparationModule {}
