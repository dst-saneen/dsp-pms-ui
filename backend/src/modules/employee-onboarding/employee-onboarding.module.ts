import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { EmployeeOnboardingController } from './employee-onboarding.controller';
import { EmployeeOnboardingService } from './employee-onboarding.service';
import { EmployeeOnboardingRepository } from './repositories/employee-onboarding.repository';
import { AuditModule } from '../audit/audit.module';
import { EmployeeLifecycleSummaryModule } from '../employee-lifecycle-summary';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

// Workflow runtime scaffolding remains under ./workflow but is not registered
// until the generic engine is accepted. Controllers must not call stub methods.

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    EmployeeLifecycleSummaryModule,
    OnboardingRuntimeModule,
    forwardRef(() => RecruitmentModule),
  ],

  controllers: [EmployeeOnboardingController],

  providers: [EmployeeOnboardingService, EmployeeOnboardingRepository],

  exports: [
    EmployeeOnboardingService,
    EmployeeOnboardingRepository,
    EmployeeLifecycleSummaryModule,
  ],
})
export class EmployeeOnboardingModule {}
