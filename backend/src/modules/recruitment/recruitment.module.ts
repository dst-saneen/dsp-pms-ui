import { Module, forwardRef } from '@nestjs/common';

import { EmployeeOnboardingModule } from '../employee-onboarding/employee-onboarding.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { EmployeeCareerService } from './career/employee-career.service';
import {
  HrEmployeeCareerController,
  MeCareerController,
} from './career/employee-career.controller';
import { CandidateController } from './candidate/candidate.controller';
import { CandidateService } from './candidate/candidate.service';
import { ConversionController } from './conversion/conversion.controller';
import { ConversionService } from './conversion/conversion.service';
import { RecruitmentDomainScopeService } from './core/recruitment-domain-scope.service';
import { RecruitmentDashboardController } from './dashboard/recruitment-dashboard.controller';
import { RecruitmentDashboardService } from './dashboard/recruitment-dashboard.service';
import { RecruitmentDocumentModule } from './document/recruitment-document.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import {
  InterviewController,
  InterviewListController,
} from './interview/interview.controller';
import { InterviewPrerequisitesService } from './interview/interview-prerequisites.service';
import { InterviewService } from './interview/interview.service';
import { JobApplicationController } from './job-application/job-application.controller';
import { JobApplicationService } from './job-application/job-application.service';
import { JobOpeningController } from './job-opening/job-opening.controller';
import { JobOpeningService } from './job-opening/job-opening.service';
import { OfferController, OfferListController } from './offer/offer.controller';
import { OfferService } from './offer/offer.service';
import { EmployeeProbationController } from './probation/employee-probation.controller';
import { EmployeeProbationService } from './probation/employee-probation.service';
import { PublicCareersController } from './public/public-careers.controller';
import { PublicCareersAbuseService } from './public/public-careers-abuse.service';
import { PublicCareerOpeningService } from './public/public-career-opening.service';
import { PublicOfferResponseController } from './public/public-offer-response.controller';
import { RecruitmentMeController } from './recruitment-me/recruitment-me.controller';
import { RecruitmentMeService } from './recruitment-me/recruitment-me.service';
import { CareerEventService } from './services/career-event.service';
import { DesignationOnboardingAssignmentService } from './services/designation-onboarding-assignment.service';
import { RecruitmentCommandReceiptService } from './services/recruitment-command-receipt.service';
import { RecruitmentOutboxService } from './services/recruitment-outbox.service';
import { RecruitmentFeatureGateService } from './services/recruitment-feature-gate.service';
import { RecruitmentShortlistGateService } from './services/recruitment-shortlist-gate.service';
import {
  PublicCareersEnabledGuard,
  RecruitmentEnabledGuard,
  RecruitmentShortlistEnabledGuard,
} from './guards/recruitment-feature.guard';
import {
  EmployeeLifecycleTransitionService,
  JobApplicationTransitionService,
  JobOpeningTransitionService,
} from './transitions';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    forwardRef(() => OnboardingRuntimeModule),
    forwardRef(() => AssetDomainModule),
    forwardRef(() => EmployeeOnboardingModule),
    RecruitmentDocumentModule,
    forwardRef(() => OutboxModule),
    forwardRef(() => FileStorageModule),
  ],
  controllers: [
    JobOpeningController,
    CandidateController,
    JobApplicationController,
    InterviewController,
    InterviewListController,
    RecruitmentDashboardController,
    RecruitmentMeController,
    OfferController,
    OfferListController,
    ConversionController,
    PublicCareersController,
    PublicOfferResponseController,
    HrEmployeeCareerController,
    MeCareerController,
    EmployeeProbationController,
  ],
  providers: [
    RecruitmentDomainScopeService,
    JobOpeningTransitionService,
    JobApplicationTransitionService,
    EmployeeLifecycleTransitionService,
    CareerEventService,
    DesignationOnboardingAssignmentService,
    RecruitmentOutboxService,
    RecruitmentCommandReceiptService,
    RecruitmentFeatureGateService,
    RecruitmentShortlistGateService,
    InterviewPrerequisitesService,
    InterviewService,
    JobOpeningService,
    CandidateService,
    JobApplicationService,
    RecruitmentDashboardService,
    RecruitmentMeService,
    OfferService,
    ConversionService,
    EmployeeCareerService,
    EmployeeProbationService,
    PublicCareersAbuseService,
    PublicCareerOpeningService,
    RecruitmentEnabledGuard,
    RecruitmentShortlistEnabledGuard,
    PublicCareersEnabledGuard,
  ],
  exports: [
    RecruitmentDomainScopeService,
    JobOpeningTransitionService,
    JobApplicationTransitionService,
    EmployeeLifecycleTransitionService,
    JobOpeningService,
    CandidateService,
    JobApplicationService,
    RecruitmentDashboardService,
    RecruitmentMeService,
    OfferService,
    ConversionService,
    EmployeeCareerService,
    EmployeeProbationService,
    DesignationOnboardingAssignmentService,
    CareerEventService,
    RecruitmentOutboxService,
    PublicCareersAbuseService,
    PublicCareerOpeningService,
  ],
})
export class RecruitmentModule {}
