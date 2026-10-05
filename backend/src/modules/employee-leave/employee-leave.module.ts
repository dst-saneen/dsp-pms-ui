import { Module } from '@nestjs/common';

import { EmployeeLeaveController } from './employee-leave.controller';
import { EmployeeLeaveService } from './employee-leave.service';

import { EmployeeLeaveBalanceModule } from '../employee-leave-balance/employee-leave-balance.module';
import { LeaveRequestModule } from '../leave-request/leave-request.module';

@Module({
  imports: [EmployeeLeaveBalanceModule, LeaveRequestModule],
  controllers: [EmployeeLeaveController],
  providers: [EmployeeLeaveService],
  exports: [EmployeeLeaveService],
})
export class EmployeeLeaveModule {}
