import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';
import { OnboardingTemplateModule } from '../onboarding-template/onboarding-template.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { OnboardingExecutionRuleController } from './controllers/onboarding-execution-rule.controller';

import { OnboardingExecutionRuleService } from './services/onboarding-execution-rule.service';
import { OnboardingExecutionRuleValidationService } from './services/onboarding-execution-rule-validation.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OnboardingTemplateModule,
    OnboardingRuntimeModule,
  ],
  controllers: [OnboardingExecutionRuleController],
  providers: [
    OnboardingExecutionRuleService,
    OnboardingExecutionRuleValidationService,
  ],
  exports: [OnboardingExecutionRuleService],
})
export class OnboardingExecutionRuleModule {}
