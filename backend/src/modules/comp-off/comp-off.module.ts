import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeeLeaveBalanceModule } from '../employee-leave-balance/employee-leave-balance.module';
import { WorkforcePolicyModule } from '../workforce-policy/workforce-policy.module';

import { CompOffAllocationService } from './comp-off-allocation.service';
import { CompOffController } from './comp-off.controller';
import { CompOffCreditService } from './comp-off-credit.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    WorkforcePolicyModule,
    EmployeeLeaveBalanceModule,
  ],
  controllers: [CompOffController],
  providers: [CompOffCreditService, CompOffAllocationService],
  exports: [CompOffCreditService, CompOffAllocationService],
})
export class CompOffModule {}
