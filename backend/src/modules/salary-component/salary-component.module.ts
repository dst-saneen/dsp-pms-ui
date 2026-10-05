import { Module } from '@nestjs/common';
import { SalaryComponentService } from './salary-component.service';
import { SalaryComponentController } from './salary-component.controller';

@Module({
  controllers: [SalaryComponentController],
  providers: [SalaryComponentService],
})
export class SalaryComponentModule {}
