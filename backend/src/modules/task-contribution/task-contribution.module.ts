import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { TaskContributionController } from './controllers/task-contribution.controller';

import {
  TaskContributionService,
  TaskContributionValidationService,
} from './services';

@Module({
  imports: [PrismaModule, OnboardingTemplateModule, OnboardingRuntimeModule],

  controllers: [TaskContributionController],

  providers: [TaskContributionService, TaskContributionValidationService],

  exports: [TaskContributionService],
})
export class TaskContributionModule {}
