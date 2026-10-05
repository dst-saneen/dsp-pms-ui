import { Module } from '@nestjs/common';
import { EmployeeTaxProfileService } from './employee-tax-profile.service';
import { EmployeeTaxProfileController } from './employee-tax-profile.controller';

@Module({
  controllers: [EmployeeTaxProfileController],
  providers: [EmployeeTaxProfileService],
})
export class EmployeeTaxProfileModule {}
