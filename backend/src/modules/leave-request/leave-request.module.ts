import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CompOffModule } from '../comp-off/comp-off.module';
import { EmployeeLeaveBalanceModule } from '../employee-leave-balance/employee-leave-balance.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WorkforceApprovalModule } from '../workforce-approval/workforce-approval.module';

import { LeaveRequestController } from './leave-request.controller';
import { LeaveRequestService } from './leave-request.service';

@Module({
  imports: [
    PrismaModule,
    LeavePolicyModule,
    AuditModule,
    WorkforceApprovalModule,
    EmployeeLeaveBalanceModule,
    CompOffModule,
    OutboxModule,
  ],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
