import { Module } from '@nestjs/common';
import { PayrollDashboardController } from './payroll-dashboard.controller';
import { PayrollDashboardService } from './payroll-dashboard.service';

@Module({
  controllers: [PayrollDashboardController],
  providers: [PayrollDashboardService],
})
export class PayrollDashboardModule {}
