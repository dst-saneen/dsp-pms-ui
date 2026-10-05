import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingWorkspaceController } from './controllers/onboarding-workspace.controller';

import { OnboardingWorkspaceService } from './services';

import { WorkspaceMapper } from './mappers';

import {
  ContributionAssembler,
  DepartmentAssembler,
  TaskAssembler,
  TaskGroupAssembler,
  TemplateAssembler,
} from './assemblers';

@Module({
  imports: [PrismaModule, OnboardingRuntimeModule],

  controllers: [OnboardingWorkspaceController],

  providers: [
    OnboardingWorkspaceService,

    TemplateAssembler,

    DepartmentAssembler,

    TaskGroupAssembler,

    TaskAssembler,

    ContributionAssembler,

    WorkspaceMapper,
  ],

  exports: [OnboardingWorkspaceService],
})
export class OnboardingWorkspaceModule {}
