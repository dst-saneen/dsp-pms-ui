import { Module } from '@nestjs/common';
import { EmployeeDeductionService } from './employee-deduction.service';
import { EmployeeDeductionController } from './employee-deduction.controller';

@Module({
  controllers: [EmployeeDeductionController],
  providers: [EmployeeDeductionService],
})
export class EmployeeDeductionModule {}
