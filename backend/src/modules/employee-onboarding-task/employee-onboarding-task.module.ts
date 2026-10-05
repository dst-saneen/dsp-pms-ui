import { Module } from '@nestjs/common';
import { EmployeeOnboardingTaskService } from './employee-onboarding-task.service';
import { EmployeeOnboardingTaskController } from './employee-onboarding-task.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

@Module({
  imports: [PrismaModule, AuditModule, OnboardingRuntimeModule],
  controllers: [EmployeeOnboardingTaskController],
  providers: [EmployeeOnboardingTaskService],
})
export class EmployeeOnboardingTaskModule {}
