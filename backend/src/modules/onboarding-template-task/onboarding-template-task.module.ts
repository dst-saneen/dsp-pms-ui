import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingTemplateTaskController } from './controllers';

import {
  OnboardingTemplateTaskService,
  OnboardingTemplateTaskValidationService,
} from './services';

@Module({
  imports: [PrismaModule, OnboardingTemplateModule, OnboardingRuntimeModule],

  controllers: [OnboardingTemplateTaskController],

  providers: [
    OnboardingTemplateTaskService,

    OnboardingTemplateTaskValidationService,
  ],

  exports: [
    OnboardingTemplateTaskService,

    OnboardingTemplateTaskValidationService,
  ],
})
export class OnboardingTemplateTaskModule {}
