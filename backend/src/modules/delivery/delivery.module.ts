import { Module } from '@nestjs/common';

import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { RecruitmentDocumentModule } from '../recruitment/document/recruitment-document.module';

import { DeliveryController } from './delivery.controller';
import { DeliveryClaimService } from './delivery-claim.service';
import { DeliveryCryptoService } from './delivery-crypto.service';
import { DeliveryEmailContentService } from './delivery-email-content.service';
import { DeliveryEmailWorker } from './delivery-email.worker';
import { DeliveryFanoutService } from './delivery-fanout.service';
import { DeliveryFeatureGateService } from './delivery-feature-gate.service';
import { DeliveryEnabledGuard } from './guards/delivery-enabled.guard';
import { DeliveryInAppWorker } from './delivery-inapp.worker';
import { DeliveryJobsScheduler } from './delivery-jobs.scheduler';
import { DeliveryLeaseRecoveryService } from './delivery-lease-recovery.service';
import { DeliveryQueryService } from './delivery-query.service';
import { DeliverySuppressionService } from './delivery-suppression.service';
import { DeliveryHrRecipientService } from './resolution/delivery-hr-recipient.service';
import { DeliveryOnboardingRecipientHandler } from './resolution/delivery-onboarding-recipient.handler';
import { DeliveryOfficeFinanceRecipientHandler } from './resolution/delivery-office-finance-recipient.handler';
import { DeliveryProjectRecipientHandler } from './resolution/delivery-project-recipient.handler';
import { DeliveryPayrollRecipientHandler } from './resolution/delivery-payroll-recipient.handler';
import { DeliveryRecipientExceptionService } from './resolution/delivery-recipient-exception.service';
import { DeliveryRecipientResolverService } from './resolution/delivery-recipient-resolver.service';
import { DeliveryRecruitmentRecipientHandler } from './resolution/delivery-recruitment-recipient.handler';
import { DeliveryWorkforceRecipientHandler } from './resolution/delivery-workforce-recipient.handler';

/**
 * ScheduleModule.forRoot() lives in WorkforceJobsModule. DeliveryJobsScheduler
 * still registers @Cron handlers once that module is loaded in AppModule.
 */
@Module({
  imports: [
    MailModule,
    NotificationModule,
    AuthModule,
    RecruitmentDocumentModule,
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryFeatureGateService,
    DeliveryEnabledGuard,
    DeliveryClaimService,
    DeliveryLeaseRecoveryService,
    DeliveryJobsScheduler,
    DeliveryFanoutService,
    DeliveryCryptoService,
    DeliveryHrRecipientService,
    DeliveryRecruitmentRecipientHandler,
    DeliveryOnboardingRecipientHandler,
    DeliveryProjectRecipientHandler,
    DeliveryPayrollRecipientHandler,
    DeliveryOfficeFinanceRecipientHandler,
    DeliveryWorkforceRecipientHandler,
    DeliveryRecipientResolverService,
    DeliveryRecipientExceptionService,
    DeliveryEmailContentService,
    DeliveryEmailWorker,
    DeliveryInAppWorker,
    DeliveryQueryService,
    DeliverySuppressionService,
  ],
  exports: [
    DeliveryFeatureGateService,
    DeliveryEnabledGuard,
    DeliveryClaimService,
    DeliveryLeaseRecoveryService,
    DeliveryJobsScheduler,
    DeliveryFanoutService,
    DeliveryRecipientResolverService,
    DeliveryRecipientExceptionService,
    DeliveryEmailWorker,
    DeliveryInAppWorker,
    DeliveryQueryService,
    DeliverySuppressionService,
  ],
})
export class DeliveryModule {}
