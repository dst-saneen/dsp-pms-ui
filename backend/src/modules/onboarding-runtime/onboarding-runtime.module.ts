import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';
import { OutboxModule } from '../outbox/outbox.module';

import { OnboardingRuntimeController } from './controllers/onboarding-runtime.controller';
import { DesignationOnboardingAssignmentController } from './controllers/designation-onboarding-assignment.controller';
import { OnboardingEnabledGuard } from './guards/onboarding-enabled.guard';
import { OnboardingResponseMapper } from './mappers/onboarding-response.mapper';
import {
  DesignationOnboardingAssignmentService,
  EmployeeOnboardingRuntimeService,
  EmployeeOnboardingTaskRuntimeService,
  OnboardingActorContextService,
  OnboardingAssetFulfillmentService,
  OnboardingAuditMapperService,
  OnboardingCapabilityService,
  OnboardingCommandReceiptService,
  OnboardingFeatureGateService,
  OnboardingImportedReconciliationService,
  OnboardingNotificationService,
  OnboardingProgressService,
  OnboardingReminderJobService,
  OnboardingScopeService,
  OnboardingTemplateResolutionService,
  OnboardingTransactionRunnerService,
} from './services';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    forwardRef(() => AssetDomainModule),
    AuditModule,
    forwardRef(() => OutboxModule),
  ],
  controllers: [
    OnboardingRuntimeController,
    DesignationOnboardingAssignmentController,
  ],
  providers: [
    OnboardingFeatureGateService,
    OnboardingEnabledGuard,
    OnboardingScopeService,
    OnboardingActorContextService,
    OnboardingProgressService,
    OnboardingCommandReceiptService,
    OnboardingTransactionRunnerService,
    OnboardingTemplateResolutionService,
    OnboardingCapabilityService,
    OnboardingAssetFulfillmentService,
    OnboardingAuditMapperService,
    OnboardingImportedReconciliationService,
    OnboardingNotificationService,
    OnboardingReminderJobService,
    DesignationOnboardingAssignmentService,
    OnboardingResponseMapper,
    EmployeeOnboardingRuntimeService,
    EmployeeOnboardingTaskRuntimeService,
  ],
  exports: [
    OnboardingFeatureGateService,
    OnboardingEnabledGuard,
    OnboardingScopeService,
    OnboardingActorContextService,
    OnboardingProgressService,
    OnboardingCommandReceiptService,
    OnboardingTransactionRunnerService,
    OnboardingTemplateResolutionService,
    OnboardingCapabilityService,
    OnboardingAssetFulfillmentService,
    OnboardingResponseMapper,
    EmployeeOnboardingRuntimeService,
    EmployeeOnboardingTaskRuntimeService,
    OnboardingReminderJobService,
  ],
})
export class OnboardingRuntimeModule {}
