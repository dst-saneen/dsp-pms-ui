import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingTaskGroupController } from './controllers/onboarding-task-group.controller';

import {
  OnboardingTaskGroupService,
  OnboardingTaskGroupValidationService,
} from './services';

@Module({
  imports: [PrismaModule, OnboardingTemplateModule, OnboardingRuntimeModule],

  controllers: [OnboardingTaskGroupController],

  providers: [OnboardingTaskGroupService, OnboardingTaskGroupValidationService],

  exports: [OnboardingTaskGroupService],
})
export class OnboardingTaskGroupModule {}
