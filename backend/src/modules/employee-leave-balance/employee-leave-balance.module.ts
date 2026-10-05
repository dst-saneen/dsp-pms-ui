import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';

import { EmployeeLeaveBalanceService } from './employee-leave-balance.service';
import { EmployeeLeaveBalanceController } from './employee-leave-balance.controller';
import { LeaveBalanceLedgerService } from './leave-balance-ledger.service';
import { LeaveBalanceGenerationService } from './leave-balance-generation.service';

@Module({
  imports: [PrismaModule, LeavePolicyModule, AuditModule],
  controllers: [EmployeeLeaveBalanceController],
  providers: [
    EmployeeLeaveBalanceService,
    LeaveBalanceGenerationService,
    LeaveBalanceLedgerService,
  ],
  exports: [
    EmployeeLeaveBalanceService,
    LeaveBalanceGenerationService,
    LeaveBalanceLedgerService,
  ],
})
export class EmployeeLeaveBalanceModule {}
