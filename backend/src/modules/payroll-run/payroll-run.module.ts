import { Module } from '@nestjs/common';
import { PayrollRunService } from './payroll-run.service';
import { PayrollRunController } from './payroll-run.controller';

@Module({
  controllers: [PayrollRunController],
  providers: [PayrollRunService],
})
export class PayrollRunModule {}
