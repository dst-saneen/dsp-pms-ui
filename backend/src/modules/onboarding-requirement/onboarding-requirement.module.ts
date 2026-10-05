import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingRequirementController } from './controllers/onboarding-requirement.controller';

import { OnboardingRequirementService } from './services/onboarding-requirement.service';
import { OnboardingRequirementValidationService } from './services/onboarding-requirement-validation.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OnboardingTemplateModule,
    OnboardingRuntimeModule,
  ],
  controllers: [OnboardingRequirementController],
  providers: [
    OnboardingRequirementService,
    OnboardingRequirementValidationService,
  ],
  exports: [OnboardingRequirementService],
})
export class OnboardingRequirementModule {}
