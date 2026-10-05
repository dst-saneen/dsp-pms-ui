import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { EmployeeLifecycleSummaryService } from './employee-lifecycle-summary.service';

@Module({
  imports: [PrismaModule],
  providers: [EmployeeLifecycleSummaryService],
  exports: [EmployeeLifecycleSummaryService],
})
export class EmployeeLifecycleSummaryModule {}
