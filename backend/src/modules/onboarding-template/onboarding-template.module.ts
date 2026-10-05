import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';
import { OutboxModule } from '../outbox/outbox.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingTemplateController } from './onboarding-template.controller';

import {
  OnboardingTemplateService,
  OnboardingTemplateVersionService,
  OnboardingTemplateWorkspaceService,
  OnboardingTemplateCloneService,
  OnboardingTemplateValidationService,
  OnboardingTemplateScopeService,
} from './services';

import { OnboardingTemplateWorkspaceBuilder } from './builders';

import { OnboardingTemplateVersionController } from './onboarding-template-version.controller';

@Module({
  imports: [
    forwardRef(() => AssetDomainModule),
    AuditModule,
    forwardRef(() => OutboxModule),
    forwardRef(() => OnboardingRuntimeModule),
  ],
  controllers: [
    OnboardingTemplateController,

    OnboardingTemplateVersionController,
  ],
  providers: [
    OnboardingTemplateScopeService,
    OnboardingTemplateService,
    OnboardingTemplateVersionService,
    OnboardingTemplateWorkspaceService,
    OnboardingTemplateCloneService,
    OnboardingTemplateValidationService,
    OnboardingTemplateWorkspaceBuilder,
  ],
  exports: [
    OnboardingTemplateScopeService,
    OnboardingTemplateService,
    OnboardingTemplateVersionService,
    OnboardingTemplateWorkspaceService,
    OnboardingTemplateCloneService,
    OnboardingTemplateValidationService,
  ],
})
export class OnboardingTemplateModule {}
