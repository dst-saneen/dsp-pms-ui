import { Module } from '@nestjs/common';
import { EmployeeSalaryService } from './employee-salary.service';
import { EmployeeSalaryController } from './employee-salary.controller';

@Module({
  controllers: [EmployeeSalaryController],
  providers: [EmployeeSalaryService],
})
export class EmployeeSalaryModule {}
