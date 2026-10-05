import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingDepartmentTemplateController } from './controllers';

import {
  OnboardingDepartmentTemplateService,
  OnboardingDepartmentTemplateValidationService,
} from './services';

@Module({
  imports: [PrismaModule, OnboardingTemplateModule, OnboardingRuntimeModule],

  controllers: [OnboardingDepartmentTemplateController],

  providers: [
    OnboardingDepartmentTemplateService,
    OnboardingDepartmentTemplateValidationService,
  ],

  exports: [
    OnboardingDepartmentTemplateService,
    OnboardingDepartmentTemplateValidationService,
  ],
})
export class OnboardingDepartmentTemplateModule {}
