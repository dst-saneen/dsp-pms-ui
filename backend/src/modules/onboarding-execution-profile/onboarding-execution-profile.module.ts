import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingExecutionProfileController } from './controllers/onboarding-execution-profile.controller';

import { OnboardingExecutionProfileService } from './services/onboarding-execution-profile.service';
import { OnboardingExecutionProfileValidationService } from './services/onboarding-execution-profile-validation.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OnboardingTemplateModule,
    OnboardingRuntimeModule,
  ],
  controllers: [OnboardingExecutionProfileController],
  providers: [
    OnboardingExecutionProfileService,
    OnboardingExecutionProfileValidationService,
  ],
  exports: [OnboardingExecutionProfileService],
})
export class OnboardingExecutionProfileModule {}
