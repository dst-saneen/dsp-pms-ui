import { Injectable, Logger } from '@nestjs/common';
import {
  CareerEventType,
  JobApplicationStatus,
  JobOfferStatus,
  OutboxEventStatus,
  Prisma,
  RoleScope,
  SecurityEventType,
  TaskStatus,
  UserStatus,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestId,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountLifecycleService } from '../../auth/account-lifecycle.service';
import { PasswordService } from '../../auth/password.service';
import { NumberSeriesService } from '../../number-series/number-series.service';
import { EmployeeOnboardingService } from '../../employee-onboarding/employee-onboarding.service';
import { OnboardingTemplateResolutionService } from '../../onboarding-runtime/services/onboarding-template-resolution.service';
import type { RequestSecurityMetadata } from '../../auth/auth.types';
import { RecruitmentCryptoService } from '../core/recruitment-crypto.service';
import { JobApplicationTransitionService } from '../transitions/job-application-transition.service';
import { JobOpeningTransitionService } from '../transitions/job-opening-transition.service';
import { RecruitmentOutboxService } from '../services/recruitment-outbox.service';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { FileDocumentLinkingService } from '../../file-storage/services/file-document-linking.service';
import { OfferSignatureService } from '../../file-storage/services/offer-signature.service';

interface PreflightCheck {
  code: string;
  passed: boolean;
  message: string;
}

export interface ConversionPreflightResult {
  ready: boolean;
  idempotent: boolean;
  checks: PreflightCheck[];
  employeeId?: string;
  userId?: string;
  employeeOnboardingId?: string;
  acceptedOfferId?: string;
  acceptedOfferVersion?: number;
  applicationVersion?: number;
  candidateName?: string;
  roleTitle?: string;
  organizationSummary?: string;
  joiningDate?: Date | string;
  reportingManagerName?: string;
  onboardingTemplateName?: string;
}

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberSeries: NumberSeriesService,
    private readonly accountLifecycle: AccountLifecycleService,
    private readonly passwordService: PasswordService,
    private readonly employeeOnboardingService: EmployeeOnboardingService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly openingTransitions: JobOpeningTransitionService,
    private readonly outbox: RecruitmentOutboxService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly templateResolution: OnboardingTemplateResolutionService,
    private readonly documentLinking: FileDocumentLinkingService,
    private readonly offerSignatures: OfferSignatureService,
    private readonly crypto: RecruitmentCryptoService,
  ) {}

  async preflight(applicationId: string): Promise<ConversionPreflightResult> {
    const application = await this.loadApplication(applicationId);

    const summary = this.buildConversionSummary(application);

    if (application.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: application.employeeId },
        include: {
          user: { select: { id: true } },
          employeeOnboardings: {
            where: { status: TaskStatus.IN_PROGRESS },
            take: 1,
          },
        },
      });

      return {
        ready: true,
        idempotent: true,
        checks: [
          {
            code: 'ALREADY_CONVERTED',
            passed: true,
            message: 'Application was already converted.',
          },
        ],
        employeeId: application.employeeId,
        userId: employee?.user?.id,
        employeeOnboardingId: employee?.employeeOnboardings[0]?.id,
        ...summary,
      };
    }

    const checks = await this.buildPreflightChecks(application);
    const ready = checks.every((check) => check.passed);

    return {
      ready,
      idempotent: false,
      checks,
      ...summary,
    };
  }

  async convert(
    applicationId: string,
    metadata: RequestSecurityMetadata,
    invitedByUserId: string,
  ) {
    const existing = await this.preflight(applicationId);

    if (existing.idempotent && existing.employeeId) {
      return this.buildIdempotentConversionResponse(existing.employeeId);
    }

    if (!existing.ready) {
      const failed = existing.checks.filter((check) => !check.passed);
      throw new DomainConflictException(
        'CONVERSION_PREFLIGHT_FAILED',
        `Conversion preflight failed: ${failed.map((check) => check.code).join(', ')}`,
      );
    }

    const application = await this.loadApplication(applicationId);
    const maxAttempts = 5;
    let conversionResult:
      | {
          employeeId: string;
          userId: string;
          employeeOnboardingId: string;
          invitationId: string;
          invitationExpiresAt: Date;
          invitationResendAvailableAt: Date;
          jobOpeningId: string;
          idempotent: boolean;
        }
      | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const employeeCode = await this.nextUniqueEmployeeCode();
      const username = await this.nextUniqueUsername(
        application.candidate.firstName,
        application.candidate.normalizedEmail,
      );

      try {
        conversionResult = await this.prisma.$transaction(
          async (tx) =>
            this.convertInTransaction(
              tx,
              application,
              metadata,
              invitedByUserId,
              employeeCode,
              username,
            ),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5_000,
            timeout: 30_000,
          },
        );
        break;
      } catch (error) {
        if (attempt < maxAttempts && this.isRetryableConversionError(error)) {
          continue;
        }

        if (this.isUniqueConflict(error)) {
          throw new DomainConflictException(
            'CONVERSION_UNIQUE_CONFLICT',
            'Conversion could not create a unique employee code or login. Please retry.',
          );
        }

        throw error;
      }
    }

    if (!conversionResult) {
      throw new DomainConflictException(
        'CONVERSION_SERIALIZATION_FAILED',
        'Conversion failed due to concurrent updates.',
      );
    }

    if (conversionResult.idempotent) {
      return this.buildIdempotentConversionResponse(
        conversionResult.employeeId,
      );
    }

    // Invitation mail is asynchronous via Outbox → Delivery. Never send here.
    const invitationDelivery = await this.repairInvitationDelivery(
      conversionResult.invitationId,
    );

    const opening = await this.prisma.jobOpening.findUnique({
      where: { id: conversionResult.jobOpeningId },
    });

    if (
      opening &&
      opening.headcountFilled >= opening.headcountTotal &&
      opening.status !== 'FILLED'
    ) {
      await this.openingTransitions.markFilled(opening.id, opening.version);
    }

    return {
      employeeId: conversionResult.employeeId,
      userId: conversionResult.userId,
      employeeOnboardingId: conversionResult.employeeOnboardingId,
      invitationId: conversionResult.invitationId,
      invitationExpiresAt: conversionResult.invitationExpiresAt,
      invitationResendAvailableAt: conversionResult.invitationResendAvailableAt,
      invitationDelivery,
      idempotent: false,
    };
  }

  private async buildIdempotentConversionResponse(employeeId: string) {
    const user = await this.prisma.user.findFirst({
      where: { employeeId },
      select: {
        id: true,
        invitations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
            resendAvailableAt: true,
            sentAt: true,
          },
        },
      },
    });

    const onboarding = await this.prisma.employeeOnboarding.findFirst({
      where: { employeeId, status: TaskStatus.IN_PROGRESS },
      select: { id: true },
    });

    const invitation = user?.invitations[0];
    const invitationDelivery = invitation
      ? await this.repairInvitationDelivery(invitation.id)
      : {
          status: 'MISSING_INVITATION' as const,
          outboxEventId: null,
          outboxStatus: null,
          deliveryMessageId: null,
          deliveryStatus: null,
          sentAt: null,
        };

    return {
      employeeId,
      userId: user?.id,
      employeeOnboardingId: onboarding?.id,
      invitationId: invitation?.id,
      invitationExpiresAt: invitation?.expiresAt,
      invitationResendAvailableAt: invitation?.resendAvailableAt,
      invitationDelivery,
      idempotent: true,
    };
  }

  /**
   * Ensures the invitation Outbox event exists and is eligible for
   * (re)processing when DeliveryMessage is missing. Never creates a
   * second UserInvitation or Employee.
   */
  private async repairInvitationDelivery(invitationId: string): Promise<{
    status: string;
    outboxEventId: string | null;
    outboxStatus: string | null;
    deliveryMessageId: string | null;
    deliveryStatus: string | null;
    sentAt: Date | null;
  }> {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        sentAt: true,
        userId: true,
        user: {
          select: {
            employee: {
              select: {
                id: true,
                companyId: true,
                branchId: true,
                company: { select: { companyGroupId: true } },
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return {
        status: 'MISSING_INVITATION',
        outboxEventId: null,
        outboxStatus: null,
        deliveryMessageId: null,
        deliveryStatus: null,
        sentAt: null,
      };
    }

    const employee = invitation.user.employee;
    const dedupeKey = `recruitment:invitation:${invitationId}`;

    let outboxEvent = await this.prisma.outboxEvent.findUnique({
      where: { dedupeKey },
      select: {
        id: true,
        status: true,
        processedAt: true,
      },
    });

    if (!outboxEvent && employee) {
      await this.prisma.$transaction(async (tx) =>
        this.outbox.enqueue(
          tx,
          'recruitment.employee.invitation',
          invitationId,
          {
            companyGroupId: employee.company.companyGroupId,
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId: employee.id,
            invitationId,
            userId: invitation.userId,
          },
          dedupeKey,
        ),
      );
      outboxEvent = await this.prisma.outboxEvent.findUnique({
        where: { dedupeKey },
        select: { id: true, status: true, processedAt: true },
      });
    }

    if (!outboxEvent) {
      return {
        status: 'OUTBOX_MISSING',
        outboxEventId: null,
        outboxStatus: null,
        deliveryMessageId: null,
        deliveryStatus: null,
        sentAt: invitation.sentAt,
      };
    }

    const deliveryMessage = await this.prisma.deliveryMessage.findFirst({
      where: {
        outboxEventId: outboxEvent.id,
        eventType: 'recruitment.employee.invitation',
        channel: 'EMAIL',
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true },
    });

    if (
      !deliveryMessage &&
      (outboxEvent.status === OutboxEventStatus.PROCESSED ||
        outboxEvent.status === OutboxEventStatus.FAILED)
    ) {
      await this.prisma.outboxEvent.update({
        where: { id: outboxEvent.id },
        data: {
          status: OutboxEventStatus.PENDING,
          processedAt: null,
          lockedAt: null,
          availableAt: new Date(),
          lastErrorCode: 'INVITATION_DELIVERY_REPAIR',
        },
      });
      outboxEvent = {
        ...outboxEvent,
        status: OutboxEventStatus.PENDING,
        processedAt: null,
      };
    }

    let status = 'QUEUED';
    if (deliveryMessage) {
      status = deliveryMessage.status;
    } else if (invitation.sentAt) {
      status = 'SENT_LEGACY';
    } else if (outboxEvent.status === OutboxEventStatus.PENDING) {
      status = 'OUTBOX_PENDING';
    } else if (outboxEvent.status === OutboxEventStatus.PROCESSING) {
      status = 'OUTBOX_PROCESSING';
    } else if (outboxEvent.status === OutboxEventStatus.FAILED) {
      status = 'OUTBOX_FAILED';
    }

    return {
      status,
      outboxEventId: outboxEvent.id,
      outboxStatus: outboxEvent.status,
      deliveryMessageId: deliveryMessage?.id ?? null,
      deliveryStatus: deliveryMessage?.status ?? null,
      sentAt: invitation.sentAt,
    };
  }

  private async convertInTransaction(
    tx: Prisma.TransactionClient,
    application: Awaited<ReturnType<ConversionService['loadApplication']>>,
    metadata: RequestSecurityMetadata,
    invitedByUserId: string,
    employeeCode: string,
    username: string,
  ) {
    const lockedApplication = await tx.jobApplication.findFirst({
      where: {
        id: application.id,
        ...this.scope.jobApplicationWhere(),
      },
      select: {
        id: true,
        version: true,
        status: true,
        employeeId: true,
        candidateId: true,
        jobOpeningId: true,
      },
    });

    if (!lockedApplication) {
      throw new DomainNotFoundException(
        'APPLICATION_NOT_FOUND',
        'Application not found.',
      );
    }

    await tx.$queryRaw`
      SELECT id FROM job_applications WHERE id = ${lockedApplication.id} FOR UPDATE
    `;
    await tx.$queryRaw`
      SELECT id FROM job_openings WHERE id = ${lockedApplication.jobOpeningId} FOR UPDATE
    `;

    if (lockedApplication.employeeId) {
      const user = await tx.user.findFirst({
        where: { employeeId: lockedApplication.employeeId },
        select: {
          id: true,
          invitations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              expiresAt: true,
              resendAvailableAt: true,
            },
          },
        },
      });
      const templateResolution = await this.resolveOnboardingTemplate(tx, {
        designationId: application.jobOpening.designationId,
        branchId: application.jobOpening.branchId,
        companyId: application.jobOpening.companyId,
      });
      const onboarding =
        await this.employeeOnboardingService.createInTransaction(tx, {
          employeeId: lockedApplication.employeeId,
          templateId: templateResolution.templateId,
          startDate: application.offers[0]?.joiningDate ?? new Date(),
          remarks: 'Repaired from recruitment conversion.',
        });
      const invitation = user?.invitations[0];
      const fallbackDate = new Date();

      return {
        employeeId: lockedApplication.employeeId,
        userId: user?.id ?? '',
        employeeOnboardingId: onboarding.id,
        invitationId: invitation?.id ?? '',
        invitationExpiresAt: invitation?.expiresAt ?? fallbackDate,
        invitationResendAvailableAt:
          invitation?.resendAvailableAt ?? fallbackDate,
        jobOpeningId: lockedApplication.jobOpeningId,
        idempotent: true,
      };
    }

    const acceptedOffer = application.offers[0];

    if (!acceptedOffer) {
      throw new DomainConflictException(
        'OFFER_NOT_ACCEPTED',
        'Accepted offer is required for conversion.',
      );
    }

    await tx.$queryRaw`
      SELECT id FROM job_offers WHERE id = ${acceptedOffer.id} FOR UPDATE
    `;

    await this.offerSignatures.assertConversionAllowed(
      acceptedOffer.id,
      acceptedOffer.companyId,
      tx,
    );

    const opening = application.jobOpening;

    if (opening.headcountReserved <= 0) {
      throw new DomainConflictException(
        'HEADCOUNT_NOT_RESERVED',
        'Headcount reservation is missing for this opening.',
      );
    }

    const templateResolution = await this.resolveOnboardingTemplate(tx, {
      designationId: opening.designationId,
      branchId: opening.branchId,
      companyId: opening.companyId,
    });

    if (!opening.company.companyGroupId) {
      throw new DomainConflictException(
        'COMPANY_GROUP_MISSING',
        'Company group is required for conversion.',
      );
    }

    const now = new Date();
    const joiningDate = acceptedOffer.joiningDate;
    const employee = await tx.employee.create({
      data: {
        employeeCode,
        companyId: opening.companyId,
        branchId: opening.branchId,
        departmentId: opening.departmentId,
        designationId: opening.designationId,
        firstName: application.candidate.firstName,
        lastName: application.candidate.lastName,
        email: application.candidate.email,
        mobile: application.candidate.mobile,
        managerId: acceptedOffer.reportingManagerEmployeeId,
        joiningDate,
        employmentStatus: 'PENDING_ONBOARDING',
        creationSource: 'RECRUITMENT',
        sourceCandidateId: application.candidateId,
        isActive: true,
      },
    });

    await tx.candidate.update({
      where: { id: application.candidateId },
      data: { employeeId: employee.id },
    });

    const currentApplication = await tx.jobApplication.findUniqueOrThrow({
      where: { id: application.id },
    });

    await this.applicationTransitions.transitionInTransaction(
      tx,
      {
        ...currentApplication,
        version: lockedApplication.version,
        status: lockedApplication.status,
      },
      JobApplicationStatus.HIRED,
      {
        hiredAt: now,
        actorId: invitedByUserId,
      },
    );

    await tx.jobApplication.update({
      where: { id: application.id },
      data: { employeeId: employee.id },
    });

    await tx.jobOpening.update({
      where: { id: opening.id },
      data: {
        headcountReserved: { decrement: 1 },
        headcountFilled: { increment: 1 },
      },
    });

    const invitation = this.accountLifecycle.prepareInvitation(now);
    const normalizedEmail = application.candidate.normalizedEmail;
    const employeeRole = await tx.role.findUnique({
      where: { code: 'EMPLOYEE' },
      select: { id: true, isActive: true },
    });

    if (!employeeRole?.isActive) {
      throw new DomainConflictException(
        'EMPLOYEE_ROLE_UNAVAILABLE',
        'Employee role is unavailable.',
      );
    }

    const user = await tx.user.create({
      data: {
        username,
        normalizedUsername: username.toLowerCase(),
        displayName:
          `${application.candidate.firstName} ${application.candidate.lastName ?? ''}`.trim(),
        email: application.candidate.email,
        normalizedEmail,
        passwordHash: null,
        status: UserStatus.INVITED,
        employeeId: employee.id,
        defaultCompanyGroupId: opening.company.companyGroupId,
        defaultCompanyId: opening.companyId,
        defaultBranchId: opening.branchId,
        mustChangePassword: false,
      },
    });

    await tx.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: employeeRole.id,
        scope: RoleScope.BRANCH,
        scopeKey: `BRANCH:${opening.branchId}`,
        companyGroupId: null,
        companyId: opening.companyId,
        branchId: opening.branchId,
      },
    });

    const userInvitation = await tx.userInvitation.create({
      data: {
        userId: user.id,
        companyGroupId: opening.company.companyGroupId,
        invitedByUserId,
        email: application.candidate.email,
        normalizedEmail,
        tokenHash: invitation.tokenHash,
        tokenCiphertext: this.crypto.encrypt(invitation.token),
        expiresAt: invitation.expiresAt,
        resendAvailableAt: invitation.resendAvailableAt,
        ipHash: this.passwordService.hashMetadata(metadata.ip),
        userAgentHash: this.passwordService.hashMetadata(metadata.userAgent),
      },
    });

    await tx.securityEvent.create({
      data: {
        userId: user.id,
        type: SecurityEventType.USER_INVITED,
        requestId: getRequestId(),
        ipHash: this.passwordService.hashMetadata(metadata.ip),
        metadata: {
          invitationId: userInvitation.id,
          invitedByUserId,
          source: 'RECRUITMENT_CONVERSION',
        },
      },
    });

    await tx.employeeCareerEvent.create({
      data: {
        employeeId: employee.id,
        eventType: CareerEventType.EMPLOYEE_CREATED,
        eventAt: now,
        employeeVisibleSummary: 'Employee record created from recruitment.',
        sourceModule: 'recruitment',
        sourceRecordId: application.id,
        actorUserId: invitedByUserId,
      },
    });

    await this.projectRecruitmentCareerEvents(tx, application, employee.id);

    const onboarding = await this.employeeOnboardingService.createInTransaction(
      tx,
      {
        employeeId: employee.id,
        templateId: templateResolution.templateId,
        startDate: joiningDate,
        remarks: 'Created from recruitment conversion.',
      },
    );

    await this.outbox.enqueue(
      tx,
      'recruitment.conversion.completed',
      application.id,
      {
        companyGroupId: opening.company.companyGroupId,
        companyId: opening.companyId,
        branchId: opening.branchId,
        jobApplicationId: application.id,
        jobOpeningId: opening.id,
        employeeId: employee.id,
        candidateId: application.candidateId,
      },
      `recruitment:conversion:${application.id}`,
    );

    await this.documentLinking.linkInConversionTransaction(tx, {
      applicationId: application.id,
      employeeId: employee.id,
      companyId: opening.companyId,
      branchId: opening.branchId,
    });

    await this.outbox.enqueue(
      tx,
      'recruitment.employee.invitation',
      userInvitation.id,
      {
        companyGroupId: opening.company.companyGroupId,
        companyId: opening.companyId,
        branchId: opening.branchId,
        jobApplicationId: application.id,
        jobOpeningId: opening.id,
        employeeId: employee.id,
        candidateId: application.candidateId,
        invitationId: userInvitation.id,
        userId: user.id,
      },
      `recruitment:invitation:${userInvitation.id}`,
    );

    return {
      employeeId: employee.id,
      userId: user.id,
      invitationId: userInvitation.id,
      invitationExpiresAt: invitation.expiresAt,
      invitationResendAvailableAt: invitation.resendAvailableAt,
      jobOpeningId: opening.id,
      employeeOnboardingId: onboarding.id,
      idempotent: false,
    };
  }

  private async buildPreflightChecks(
    application: Awaited<ReturnType<ConversionService['loadApplication']>>,
  ): Promise<PreflightCheck[]> {
    const acceptedOffer = application.offers[0];
    const opening = application.jobOpening;
    const checks: PreflightCheck[] = [];

    checks.push({
      code: 'OFFER_ACCEPTED',
      passed: Boolean(acceptedOffer),
      message: acceptedOffer
        ? `Accepted offer version ${acceptedOffer.versionNo} found.`
        : 'No accepted offer found.',
    });

    checks.push({
      code: 'HEADCOUNT_RESERVED',
      passed: opening.headcountReserved > 0,
      message:
        opening.headcountReserved > 0
          ? 'Headcount position is reserved.'
          : 'No headcount reservation found.',
    });

    checks.push({
      code: 'NOT_ALREADY_CONVERTED',
      passed: !application.employeeId,
      message: application.employeeId
        ? 'Application is already converted.'
        : 'Application has not been converted.',
    });

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      application.candidate.email,
    );
    checks.push({
      code: 'CANDIDATE_EMAIL_VALID',
      passed: emailValid,
      message: emailValid
        ? 'Candidate email is valid for invitation.'
        : 'Candidate email is missing or invalid.',
    });

    const orgActive =
      opening.company.isActive &&
      opening.branch.isActive &&
      opening.department.isActive &&
      opening.designation.isActive;
    checks.push({
      code: 'ORGANIZATION_ACTIVE',
      passed: orgActive,
      message: orgActive
        ? 'Company, branch, department, and designation are active.'
        : 'Organization references are inactive.',
    });

    const manager = await this.prisma.employee.findFirst({
      where: {
        id: acceptedOffer?.reportingManagerEmployeeId,
        isActive: true,
        companyId: opening.companyId,
      },
      select: { id: true },
    });
    checks.push({
      code: 'MANAGER_ACTIVE',
      passed: Boolean(manager),
      message: manager
        ? 'Reporting manager is active.'
        : 'Reporting manager is missing or inactive.',
    });

    const templateResolution = await this.resolveOnboardingTemplate(
      this.prisma,
      {
        designationId: opening.designationId,
        branchId: opening.branchId,
        companyId: opening.companyId,
      },
    ).catch(() => null);

    checks.push({
      code: 'ONBOARDING_TEMPLATE_CONFIGURED',
      passed: Boolean(templateResolution),
      message: templateResolution
        ? 'Published onboarding template resolved.'
        : 'Onboarding template is not configured.',
    });

    const conflictingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { normalizedEmail: application.candidate.normalizedEmail },
          { employee: { email: application.candidate.email } },
        ],
      },
      select: { id: true },
    });
    checks.push({
      code: 'NO_CONFLICTING_USER',
      passed: !conflictingUser,
      message: conflictingUser
        ? 'A conflicting user identity already exists.'
        : 'No conflicting user identity found.',
    });

    const existingFromCandidate = await this.prisma.employee.findFirst({
      where: { sourceCandidateId: application.candidateId },
      select: { id: true, employeeCode: true },
    });
    checks.push({
      code: 'CANDIDATE_NOT_ALREADY_EMPLOYEE',
      passed: !existingFromCandidate,
      message: existingFromCandidate
        ? `This candidate is already linked to ${existingFromCandidate.employeeCode}.`
        : 'Candidate is not already linked to an employee.',
    });

    if (acceptedOffer) {
      const verifiedSubmission =
        await this.prisma.offerSignatureSubmission.findFirst({
          where: {
            jobOfferId: acceptedOffer.id,
            status: 'VERIFIED',
          },
          include: {
            fileObject: { select: { status: true } },
            recruitmentDocument: { select: { id: true } },
          },
        });

      const signedOfferVerified =
        verifiedSubmission !== null &&
        verifiedSubmission.fileObject?.status === 'CLEAN' &&
        verifiedSubmission.recruitmentDocument !== null;

      checks.push({
        code: 'SIGNED_OFFER_VERIFIED',
        passed: signedOfferVerified,
        message: signedOfferVerified
          ? 'Signed offer has been verified by HR.'
          : 'Signed offer is required and must be verified before conversion.',
      });
    } else {
      checks.push({
        code: 'SIGNED_OFFER_VERIFIED',
        passed: false,
        message: 'No accepted offer found to verify signed document.',
      });
    }

    const mappingCount =
      await this.prisma.recruitmentEmployeeDocumentMapping.count({
        where: {
          companyId: opening.companyId,
          mappingKind: { in: ['CV', 'GENERATED_OFFER', 'SIGNED_OFFER'] },
        },
      });
    checks.push({
      code: 'DOCUMENT_TYPE_MAPPING',
      passed: mappingCount >= 3,
      message:
        mappingCount >= 3
          ? 'Recruitment to Employee document mappings are configured.'
          : 'Configure Recruitment-to-Employee document type mappings before conversion.',
    });

    return checks;
  }

  private async resolveOnboardingTemplate(
    client: Prisma.TransactionClient | PrismaService,
    input: {
      designationId: string;
      branchId: string;
      companyId: string;
    },
  ) {
    const resolved =
      await this.templateResolution.resolvePublishedTemplateVersion(
        input.companyId,
        input.branchId,
        input.designationId,
        new Date(),
        client,
      );

    return {
      templateId: resolved.onboardingTemplateId,
      templateVersionId: resolved.publishedVersion.id,
    };
  }

  private async loadApplication(applicationId: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id: applicationId,
        ...this.scope.jobApplicationWhere(),
      },
      include: {
        candidate: true,
        jobOpening: {
          include: {
            company: true,
            branch: true,
            department: true,
            designation: true,
          },
        },
        offers: {
          where: { status: JobOfferStatus.ACCEPTED },
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: {
            reportingManager: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        interviews: {
          select: {
            id: true,
            isRequired: true,
            status: true,
          },
        },
      },
    });

    if (!application) {
      throw new DomainNotFoundException(
        'APPLICATION_NOT_FOUND',
        'Application not found.',
      );
    }

    return application;
  }

  private buildConversionSummary(
    application: Awaited<ReturnType<ConversionService['loadApplication']>>,
  ) {
    const opening = application.jobOpening;
    const candidate = application.candidate;
    const acceptedOffer = application.offers[0];
    const reportingManager = acceptedOffer?.reportingManager;

    return {
      acceptedOfferId: acceptedOffer?.id,
      acceptedOfferVersion: acceptedOffer?.version,
      applicationVersion: application.version,
      candidateName:
        `${candidate.firstName} ${candidate.lastName ?? ''}`.trim(),
      roleTitle: opening.title,
      organizationSummary: [
        opening.company.companyName,
        opening.branch.branchName,
        opening.department.departmentName,
        opening.designation.designationName,
      ]
        .filter(Boolean)
        .join(' · '),
      joiningDate: acceptedOffer?.joiningDate,
      reportingManagerName: reportingManager
        ? `${reportingManager.firstName} ${reportingManager.lastName ?? ''}`.trim()
        : undefined,
    };
  }

  private async projectRecruitmentCareerEvents(
    tx: Prisma.TransactionClient,
    application: Awaited<ReturnType<ConversionService['loadApplication']>>,
    employeeId: string,
  ) {
    const events: Array<{
      eventType: CareerEventType;
      eventAt: Date;
      employeeVisibleSummary: string;
    }> = [];

    if (application.submittedAt) {
      events.push({
        eventType: CareerEventType.APPLICATION_SUBMITTED,
        eventAt: application.submittedAt,
        employeeVisibleSummary: 'Application submitted.',
      });
    }

    const requiredInterviews = application.interviews.filter(
      (session) => session.isRequired && session.status !== 'CANCELLED',
    );
    const interviewsComplete =
      requiredInterviews.length > 0 &&
      requiredInterviews.every((session) => session.status === 'COMPLETED');
    if (interviewsComplete) {
      events.push({
        eventType: CareerEventType.INTERVIEWS_COMPLETED,
        eventAt: application.selectedAt ?? new Date(),
        employeeVisibleSummary: 'Required interviews completed.',
      });
    }

    if (application.selectedAt) {
      events.push({
        eventType: CareerEventType.SELECTED,
        eventAt: application.selectedAt,
        employeeVisibleSummary: 'Candidate selected.',
      });
    }

    if (application.offerAcceptedAt) {
      events.push({
        eventType: CareerEventType.OFFER_ACCEPTED,
        eventAt: application.offerAcceptedAt,
        employeeVisibleSummary: 'Offer accepted.',
      });
    }

    for (const event of events) {
      await tx.employeeCareerEvent.create({
        data: {
          employeeId,
          eventType: event.eventType,
          eventAt: event.eventAt,
          employeeVisibleSummary: event.employeeVisibleSummary,
          sourceModule: 'recruitment',
          sourceRecordId: application.id,
        },
      });
    }
  }

  private isRetryableConversionError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002')
    ) {
      return true;
    }

    const kind = this.getDriverErrorKind(error);
    return (
      kind === 'UniqueConstraintViolation' ||
      kind === 'TransactionWriteConflict'
    );
  }

  private isUniqueConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return true;
    }

    return this.getDriverErrorKind(error) === 'UniqueConstraintViolation';
  }

  private getDriverErrorKind(error: unknown): string | undefined {
    let current: unknown = error;
    for (
      let depth = 0;
      depth < 6 && current && typeof current === 'object';
      depth += 1
    ) {
      const record = current as {
        kind?: unknown;
        cause?: unknown;
        originalCode?: unknown;
      };
      if (typeof record.kind === 'string') {
        return record.kind;
      }
      if (record.originalCode === '23505') {
        return 'UniqueConstraintViolation';
      }
      if (record.originalCode === '40001') {
        return 'TransactionWriteConflict';
      }
      current = record.cause;
    }
    return undefined;
  }

  private async nextUniqueEmployeeCode() {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const employeeCode = await this.numberSeries.next(
        'EMPLOYEE',
        'GLOBAL',
        'EMP',
      );
      const existing = await this.prisma.employee.findUnique({
        where: { employeeCode },
        select: { id: true },
      });
      if (!existing) {
        return employeeCode;
      }
    }

    throw new DomainConflictException(
      'EMPLOYEE_CODE_UNAVAILABLE',
      'Could not allocate a unique employee code.',
    );
  }

  private async nextUniqueUsername(firstName: string, normalizedEmail: string) {
    const base = this.generateUsername(firstName, normalizedEmail);

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const username =
        attempt === 0 ? base : `${base}${attempt + 1}`.slice(0, 48);
      const existing = await this.prisma.user.findUnique({
        where: { normalizedUsername: username.toLowerCase() },
        select: { id: true },
      });
      if (!existing) {
        return username;
      }
    }

    throw new DomainConflictException(
      'USERNAME_UNAVAILABLE',
      'Could not allocate a unique username for the new employee login.',
    );
  }

  private generateUsername(firstName: string, normalizedEmail: string): string {
    const base =
      firstName
        .normalize('NFKD')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 12)
        .toLowerCase() || 'employee';
    const suffix = normalizedEmail.split('@')[0]?.slice(0, 6) ?? 'user';
    return `${base}.${suffix}`.slice(0, 48);
  }
}
