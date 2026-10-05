import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingContributionController } from './controllers/onboarding-contribution.controller';

import { OnboardingContributionService } from './services/onboarding-contribution.service';

import { OnboardingContributionValidationService } from './services/onboarding-contribution-validation.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OnboardingTemplateModule,
    OnboardingRuntimeModule,
  ],
  controllers: [OnboardingContributionController],
  providers: [
    OnboardingContributionService,
    OnboardingContributionValidationService,
  ],
  exports: [OnboardingContributionService],
})
export class OnboardingContributionModule {}
