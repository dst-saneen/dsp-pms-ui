import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompanyModuleCode,
  JobApplicationStatus,
  JobOfferStatus,
  Prisma,
  RecruitmentDeliveryStatus,
} from '@prisma/client';
import PDFDocument from 'pdfkit';
import { randomBytes } from 'node:crypto';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../../common';
import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from '../../auth/password.service';
import { RecruitmentDocumentService } from '../document/recruitment-document.service';
import { RecruitmentOutboxService } from '../services/recruitment-outbox.service';
import { JobApplicationTransitionService } from '../transitions';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { RecruitmentCryptoService } from '../core/recruitment-crypto.service';
import {
  CreateOfferDraftDto,
  ReviseOfferDto,
  UpdateOfferDraftDto,
} from './dto/offer.dto';
import { SearchOfferDto } from './dto/search-offer.dto';

const OFFER_INCLUDE = {
  jobApplication: {
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
    },
  },
  reportingManager: true,
  recruitmentDocument: true,
  deliveryAttempts: {
    orderBy: [{ createdAt: 'desc' as const }, { attemptNo: 'desc' as const }],
    take: 1,
  },
} satisfies Prisma.JobOfferInclude;

type OfferWithRelations = Prisma.JobOfferGetPayload<{
  include: typeof OFFER_INCLUDE;
}>;

const OPEN_OFFER_STATUSES = new Set<JobOfferStatus>([
  JobOfferStatus.DRAFT,
  JobOfferStatus.SENT,
]);

const OFFER_ELIGIBLE_APPLICATION_STATUSES = new Set<JobApplicationStatus>([
  JobApplicationStatus.SELECTED,
  JobApplicationStatus.OFFER_SENT,
  JobApplicationStatus.OFFER_DECLINED,
]);

@Injectable()
export class OfferService {
  private readonly nodeEnvironment: Environment['NODE_ENV'];
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly documentService: RecruitmentDocumentService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly outbox: RecruitmentOutboxService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly crypto: RecruitmentCryptoService,
    configService: ConfigService<Environment, true>,
  ) {
    this.nodeEnvironment = configService.getOrThrow('NODE_ENV', {
      infer: true,
    });
    this.frontendUrl = configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });
  }

  async listAll(query: SearchOfferDto) {
    const where: Prisma.JobOfferWhereInput = {
      jobApplication: this.scope.jobApplicationWhere(),
    };

    if (query.jobApplicationId) {
      where.jobApplicationId = query.jobApplicationId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.jobOpeningId || query.branchId) {
      where.jobApplication = {
        ...(where.jobApplication as Prisma.JobApplicationWhereInput),
        jobOpeningId: query.jobOpeningId,
        jobOpening: query.branchId
          ? {
              ...this.scope.jobOpeningWhere(),
              branchId: query.branchId,
            }
          : undefined,
      };
    }
    if (query.search) {
      where.OR = [
        {
          jobApplication: {
            applicationCode: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          jobApplication: {
            candidate: {
              firstName: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
        {
          jobApplication: {
            candidate: {
              lastName: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.jobOffer.findMany({
        where,
        include: OFFER_INCLUDE,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jobOffer.count({ where }),
    ]);

    return {
      items: items.map((item) => this.presentOffer(item)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getById(offerId: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: {
        id: offerId,
        jobApplication: this.scope.jobApplicationWhere(),
      },
      include: OFFER_INCLUDE,
    });

    if (!offer) {
      throw new DomainNotFoundException('OFFER_NOT_FOUND', 'Offer not found.');
    }

    return this.presentOffer(offer);
  }

  async listForApplication(applicationId: string) {
    await this.assertApplicationInScope(applicationId);

    const offers = await this.prisma.jobOffer.findMany({
      where: { jobApplicationId: applicationId },
      orderBy: { versionNo: 'desc' },
      include: OFFER_INCLUDE,
    });

    return offers.map((item) => this.presentOffer(item));
  }

  async getOffer(applicationId: string, offerId: string) {
    await this.assertApplicationInScope(applicationId);

    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, jobApplicationId: applicationId },
      include: OFFER_INCLUDE,
    });

    if (!offer) {
      throw new DomainNotFoundException('OFFER_NOT_FOUND', 'Offer not found.');
    }

    return this.presentOffer(offer);
  }

  private async loadOffer(applicationId: string, offerId: string) {
    await this.assertApplicationInScope(applicationId);

    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, jobApplicationId: applicationId },
      include: OFFER_INCLUDE,
    });

    if (!offer) {
      throw new DomainNotFoundException('OFFER_NOT_FOUND', 'Offer not found.');
    }

    return offer;
  }

  async createDraft(applicationId: string, dto: CreateOfferDraftDto) {
    const application = await this.assertApplicationInScope(applicationId);
    this.assertOfferEligibleStatus(application.status);

    const opening = application.jobOpening;
    const latest = await this.prisma.jobOffer.findFirst({
      where: { jobApplicationId: applicationId },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true, status: true },
    });

    if (latest && OPEN_OFFER_STATUSES.has(latest.status)) {
      throw new DomainConflictException(
        'OFFER_VERSION_OPEN',
        'Close or revise the current offer before creating another draft.',
      );
    }

    const reportingManagerEmployeeId =
      dto.reportingManagerEmployeeId ?? opening.hiringManagerEmployeeId;
    const joiningDate = dto.joiningDate
      ? new Date(dto.joiningDate)
      : (opening.targetJoiningDate ?? this.addDays(new Date(), 14));
    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : this.addDays(new Date(), 14);

    await this.assertReportingManager(
      opening.companyId,
      reportingManagerEmployeeId,
    );
    const compensationCurrency = await this.resolveCompanyCurrency(
      opening.companyId,
      dto.compensationCurrency,
    );

    const created = await this.prisma.jobOffer.create({
      data: {
        jobApplicationId: applicationId,
        versionNo: (latest?.versionNo ?? 0) + 1,
        status: JobOfferStatus.DRAFT,
        companyId: opening.companyId,
        branchId: opening.branchId,
        departmentId: opening.departmentId,
        designationId: opening.designationId,
        reportingManagerEmployeeId,
        employmentType: dto.employmentType ?? opening.employmentType,
        joiningDate,
        compensationAmount: dto.compensationAmount ?? 0,
        compensationCurrency,
        compensationPeriod: dto.compensationPeriod,
        probationDays: dto.probationDays ?? 90,
        expiryDate,
        termsText: dto.termsText,
      },
      include: OFFER_INCLUDE,
    });

    return this.presentOffer(created);
  }

  async updateDraft(
    applicationId: string,
    offerId: string,
    dto: UpdateOfferDraftDto,
  ) {
    const offer = await this.loadOffer(applicationId, offerId);

    if (offer.status !== JobOfferStatus.DRAFT) {
      throw new DomainConflictException(
        'OFFER_NOT_DRAFT',
        'Only draft offers can be edited.',
      );
    }

    if (dto.version !== undefined && offer.version !== dto.version) {
      throw new DomainConflictException(
        'OFFER_STALE_VERSION',
        'Offer was modified by another request.',
      );
    }

    if (dto.reportingManagerEmployeeId) {
      await this.assertReportingManager(
        offer.companyId,
        dto.reportingManagerEmployeeId,
      );
    }

    const compensationCurrency = dto.compensationCurrency
      ? await this.resolveCompanyCurrency(
          offer.companyId,
          dto.compensationCurrency,
        )
      : undefined;

    return this.presentOffer(
      await this.prisma.jobOffer.update({
        where: { id: offerId },
        data: {
          reportingManagerEmployeeId: dto.reportingManagerEmployeeId,
          employmentType: dto.employmentType,
          joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
          compensationAmount: dto.compensationAmount,
          compensationCurrency,
          compensationPeriod: dto.compensationPeriod,
          probationDays: dto.probationDays,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          termsText: dto.termsText,
          version: { increment: 1 },
        },
        include: OFFER_INCLUDE,
      }),
    );
  }

  async preview(applicationId: string, offerId: string) {
    const offer = await this.loadOffer(applicationId, offerId);
    const pdfBuffer = await this.renderOfferPdf(offer);

    return {
      offerId: offer.id,
      versionNo: offer.versionNo,
      status: offer.status,
      pdfBase64: pdfBuffer.toString('base64'),
    };
  }

  async send(applicationId: string, offerId: string, actorUserId: string) {
    const offer = await this.loadOffer(applicationId, offerId);

    if (offer.status !== JobOfferStatus.DRAFT) {
      throw new DomainConflictException(
        'OFFER_NOT_DRAFT',
        'Only draft offers can be sent.',
      );
    }

    const pdfBuffer = await this.renderOfferPdf(offer);
    const responseToken = randomBytes(32).toString('base64url');
    const responseTokenHash = this.passwordService.hashActionToken(
      'offer-response',
      responseToken,
    );
    const responseTokenExpiresAt = offer.expiryDate;
    const now = new Date();

    const sentOffer = await this.prisma.$transaction(async (tx) => {
      const opening = await tx.jobOpening.findUniqueOrThrow({
        where: { id: offer.jobApplication.jobOpeningId },
      });

      const available =
        opening.headcountFilled + opening.headcountReserved <
        opening.headcountTotal;

      if (!available) {
        throw new DomainConflictException(
          'HEADCOUNT_UNAVAILABLE',
          'No headcount positions remain for this opening.',
        );
      }

      const reserved = await tx.jobOpening.updateMany({
        where: {
          id: opening.id,
          headcountFilled: opening.headcountFilled,
          headcountReserved: opening.headcountReserved,
        },
        data: { headcountReserved: { increment: 1 } },
      });

      if (reserved.count !== 1) {
        throw new DomainConflictException(
          'HEADCOUNT_RESERVATION_FAILED',
          'Headcount reservation failed due to concurrent update.',
        );
      }

      const storedDocument = await this.documentService.storeGeneratedPdf({
        buffer: pdfBuffer,
        fileName: `offer-${offer.versionNo}.pdf`,
        jobApplicationId: applicationId,
        jobOfferId: offer.id,
        uploadedByUserId: actorUserId,
      });

      const deliveryAttempt = await tx.recruitmentDeliveryAttempt.create({
        data: {
          eventType: 'recruitment.offer.sent',
          status: 'QUEUED',
          jobOfferId: offer.id,
          jobApplicationId: applicationId,
          candidateId: offer.jobApplication.candidateId,
          recipientKind: 'CANDIDATE',
        },
      });

      const updatedOffer = await tx.jobOffer.update({
        where: { id: offer.id },
        data: {
          status: JobOfferStatus.SENT,
          sentAt: now,
          sentByUserId: actorUserId,
          responseTokenHash,
          responseTokenExpiresAt,
          responseTokenCiphertext: this.crypto.encrypt(responseToken),
          recruitmentDocumentId: storedDocument.id,
        },
        include: OFFER_INCLUDE,
      });

      await this.applicationTransitions.transitionInTransaction(
        tx,
        offer.jobApplication,
        JobApplicationStatus.OFFER_SENT,
        {
          offerSentAt: now,
          actorId: actorUserId,
        },
      );

      await this.outbox.enqueue(
        tx,
        'recruitment.offer.sent',
        updatedOffer.id,
        {
          companyGroupId: opening.companyGroupId,
          companyId: opening.companyId,
          branchId: opening.branchId,
          jobApplicationId: applicationId,
          jobOpeningId: opening.id,
          jobOfferId: updatedOffer.id,
          candidateId: offer.jobApplication.candidateId,
          deliveryAttemptId: deliveryAttempt.id,
        },
        `recruitment:offer-sent:${updatedOffer.id}`,
      );

      return { updatedOffer, deliveryAttemptId: deliveryAttempt.id };
    });

    return {
      offer: this.presentOffer(sentOffer.updatedOffer),
      delivery: {
        status: 'QUEUED' as const,
        attemptId: sentOffer.deliveryAttemptId,
      },
    };
  }

  async revoke(applicationId: string, offerId: string, actorUserId: string) {
    const offer = await this.loadOffer(applicationId, offerId);

    if (offer.status !== JobOfferStatus.SENT) {
      throw new DomainConflictException(
        'OFFER_NOT_SENT',
        'Only sent offers can be revoked.',
      );
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await this.releaseHeadcountReservation(
        tx,
        offer.jobApplication.jobOpeningId,
      );

      const updated = await tx.jobOffer.update({
        where: { id: offer.id },
        data: {
          status: JobOfferStatus.REVOKED,
          revokedAt: now,
          revokedByUserId: actorUserId,
          responseTokenExpiresAt: now,
          responseTokenCiphertext: null,
        },
        include: OFFER_INCLUDE,
      });

      await this.applicationTransitions.revertToSelectedAfterOfferRevoked(
        applicationId,
        offer.jobApplication.version,
        tx,
        { actorId: actorUserId },
      );

      return this.presentOffer(updated);
    });
  }

  async retryDelivery(applicationId: string, offerId: string) {
    const offer = await this.loadOffer(applicationId, offerId);

    if (offer.status !== JobOfferStatus.SENT) {
      throw new DomainConflictException(
        'OFFER_NOT_SENT',
        'Only sent offers can retry delivery.',
      );
    }

    if (!offer.responseTokenCiphertext || !offer.responseTokenExpiresAt) {
      throw new DomainConflictException(
        'OFFER_TOKEN_UNAVAILABLE',
        'Offer response token is unavailable for retry.',
      );
    }

    if (offer.responseTokenExpiresAt.getTime() <= Date.now()) {
      throw new DomainConflictException(
        'OFFER_EXPIRED',
        'Offer has expired and cannot be retried.',
      );
    }

    const latestAttempt = offer.deliveryAttempts[0];
    if (latestAttempt?.status === RecruitmentDeliveryStatus.QUEUED) {
      throw new DomainConflictException(
        'DELIVERY_IN_PROGRESS',
        'Offer email delivery is still in progress.',
      );
    }
    if (
      latestAttempt?.status === RecruitmentDeliveryStatus.SENT ||
      latestAttempt?.status === RecruitmentDeliveryStatus.BYPASSED
    ) {
      throw new DomainConflictException(
        'DELIVERY_NOT_FAILED',
        'Delivery retry is only available after a failed send.',
      );
    }

    const opening = offer.jobApplication.jobOpening;

    const attempt = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.recruitmentDeliveryAttempt.findFirst({
        where: { jobOfferId: offer.id },
        orderBy: { attemptNo: 'desc' },
        select: { attemptNo: true },
      });

      const created = await tx.recruitmentDeliveryAttempt.create({
        data: {
          eventType: 'recruitment.offer.sent',
          status: 'QUEUED',
          attemptNo: (latest?.attemptNo ?? 0) + 1,
          jobOfferId: offer.id,
          jobApplicationId: applicationId,
          candidateId: offer.jobApplication.candidateId,
          recipientKind: 'CANDIDATE',
        },
      });

      await this.outbox.enqueue(
        tx,
        'recruitment.offer.sent',
        offer.id,
        {
          companyGroupId: opening.companyGroupId,
          companyId: opening.companyId,
          branchId: opening.branchId,
          jobApplicationId: applicationId,
          jobOpeningId: opening.id,
          jobOfferId: offer.id,
          candidateId: offer.jobApplication.candidateId,
          eventCode: 'retry',
          deliveryAttemptId: created.id,
        },
        `recruitment:offer-retry:${created.id}`,
      );

      return created;
    });

    const presented = this.presentOffer({
      ...offer,
      deliveryAttempts: [attempt, ...offer.deliveryAttempts],
    });

    return {
      ...presented,
      delivery: presented.delivery,
      message: 'Offer delivery retry queued.',
    };
  }

  async expireSentOffers(asOf = new Date()) {
    const expiredOffers = await this.prisma.jobOffer.findMany({
      where: {
        status: JobOfferStatus.SENT,
        expiryDate: { lt: asOf },
        jobApplication: {
          jobOpening: {
            company: {
              isActive: true,
              moduleEntitlements: {
                some: {
                  module: CompanyModuleCode.RECRUITMENT,
                  isEnabled: true,
                },
              },
            },
          },
        },
      },
      include: {
        jobApplication: {
          select: {
            id: true,
            version: true,
            jobOpeningId: true,
          },
        },
      },
      take: 100,
    });

    let expiredCount = 0;

    for (const offer of expiredOffers) {
      await this.prisma.$transaction(async (tx) => {
        const locked = await tx.jobOffer.updateMany({
          where: {
            id: offer.id,
            status: JobOfferStatus.SENT,
          },
          data: {
            status: JobOfferStatus.EXPIRED,
            responseTokenExpiresAt: asOf,
            responseTokenCiphertext: null,
          },
        });

        if (locked.count !== 1) {
          return;
        }

        await this.releaseHeadcountReservation(
          tx,
          offer.jobApplication.jobOpeningId,
        );

        await this.applicationTransitions.revertToSelectedAfterOfferRevoked(
          offer.jobApplicationId,
          offer.jobApplication.version,
          tx,
          { reasonCode: 'OFFER_EXPIRED', actorId: 'system' },
        );
      });

      expiredCount += 1;
    }

    return { expiredCount };
  }

  async revise(applicationId: string, offerId: string, dto: ReviseOfferDto) {
    const offer = await this.loadOffer(applicationId, offerId);

    if (!OPEN_OFFER_STATUSES.has(offer.status)) {
      throw new DomainConflictException(
        'OFFER_NOT_REVISABLE',
        'Only draft or sent offers can be revised.',
      );
    }

    const actor = getRequestActor();
    const now = new Date();
    const compensationCurrency = await this.resolveCompanyCurrency(
      offer.companyId,
      dto.compensationCurrency ?? offer.compensationCurrency,
    );

    return this.prisma.$transaction(async (tx) => {
      if (offer.status === JobOfferStatus.SENT) {
        await this.releaseHeadcountReservation(
          tx,
          offer.jobApplication.jobOpeningId,
        );
      }

      const latest = await tx.jobOffer.findFirst({
        where: { jobApplicationId: applicationId },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      });

      const reportingManagerEmployeeId =
        dto.reportingManagerEmployeeId ?? offer.reportingManagerEmployeeId;
      await this.assertReportingManager(
        offer.companyId,
        reportingManagerEmployeeId,
      );

      const created = await tx.jobOffer.create({
        data: {
          jobApplicationId: applicationId,
          versionNo: (latest?.versionNo ?? offer.versionNo) + 1,
          status: JobOfferStatus.DRAFT,
          companyId: offer.companyId,
          branchId: offer.branchId,
          departmentId: offer.departmentId,
          designationId: offer.designationId,
          reportingManagerEmployeeId,
          employmentType: dto.employmentType ?? offer.employmentType,
          joiningDate: dto.joiningDate
            ? new Date(dto.joiningDate)
            : offer.joiningDate,
          compensationAmount:
            dto.compensationAmount ?? offer.compensationAmount,
          compensationCurrency,
          compensationPeriod:
            dto.compensationPeriod ?? offer.compensationPeriod,
          probationDays: dto.probationDays ?? offer.probationDays,
          expiryDate: dto.expiryDate
            ? new Date(dto.expiryDate)
            : offer.expiryDate,
          termsText: dto.termsText ?? offer.termsText,
        },
        include: OFFER_INCLUDE,
      });

      await tx.jobOffer.update({
        where: { id: offer.id },
        data: {
          status: JobOfferStatus.SUPERSEDED,
          supersededByOfferId: created.id,
          revokedAt: offer.status === JobOfferStatus.SENT ? now : undefined,
          revokedByUserId:
            offer.status === JobOfferStatus.SENT
              ? (actor.userId ?? 'system')
              : undefined,
          responseTokenExpiresAt: now,
          responseTokenCiphertext: null,
        },
      });

      if (offer.status === JobOfferStatus.SENT) {
        await this.applicationTransitions.revertToSelectedAfterOfferRevoked(
          applicationId,
          offer.jobApplication.version,
          tx,
          { actorId: actor.userId ?? 'system', reasonCode: 'OFFER_SUPERSEDED' },
        );
      }

      return this.presentOffer(created);
    });
  }

  private addDays(from: Date, days: number) {
    const next = new Date(from);
    next.setDate(next.getDate() + days);
    return next;
  }

  private async renderOfferPdf(
    offer: Prisma.JobOfferGetPayload<{ include: typeof OFFER_INCLUDE }>,
  ): Promise<Buffer> {
    const opening = offer.jobApplication.jobOpening;
    const candidate = offer.jobApplication.candidate;

    return new Promise((resolvePromise, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Employment Offer', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Offer version: ${offer.versionNo}`);
      doc.text(
        `Candidate: ${candidate.firstName} ${candidate.lastName ?? ''}`.trim(),
      );
      doc.text(`Company: ${opening.company.companyName}`);
      doc.text(`Branch: ${opening.branch.branchName}`);
      doc.text(`Department: ${opening.department.departmentName}`);
      doc.text(`Designation: ${opening.designation.designationName}`);
      doc.text(
        `Reporting manager: ${offer.reportingManager.firstName} ${offer.reportingManager.lastName ?? ''}`.trim(),
      );
      doc.text(`Joining date: ${offer.joiningDate.toISOString().slice(0, 10)}`);
      doc.text(
        `Compensation: ${offer.compensationCurrency} ${offer.compensationAmount.toString()} (${offer.compensationPeriod})`,
      );
      doc.text(`Probation days: ${offer.probationDays}`);
      doc.text(`Valid until: ${offer.expiryDate.toISOString().slice(0, 10)}`);
      doc.moveDown();

      if (offer.termsText) {
        doc.text('Terms');
        doc.text(offer.termsText);
      }

      doc.end();
    });
  }

  private async releaseHeadcountReservation(
    tx: Prisma.TransactionClient,
    jobOpeningId: string,
  ) {
    const opening = await tx.jobOpening.findUniqueOrThrow({
      where: { id: jobOpeningId },
    });

    if (opening.headcountReserved <= 0) {
      return;
    }

    await tx.jobOpening.update({
      where: { id: jobOpeningId },
      data: { headcountReserved: { decrement: 1 } },
    });
  }

  private assertOfferEligibleStatus(status: JobApplicationStatus) {
    if (!OFFER_ELIGIBLE_APPLICATION_STATUSES.has(status)) {
      throw new DomainConflictException(
        'APPLICATION_NOT_OFFER_READY',
        'Application is not ready for offer preparation.',
      );
    }
  }

  private async assertReportingManager(
    companyId: string,
    reportingManagerEmployeeId: string,
  ) {
    const manager = await this.prisma.employee.findFirst({
      where: {
        id: reportingManagerEmployeeId,
        companyId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!manager) {
      throw new BadRequestException({
        code: 'REPORTING_MANAGER_INVALID',
        message: 'Reporting manager is invalid for this company.',
      });
    }
  }

  private async resolveCompanyCurrency(
    companyId: string,
    requestedCurrency?: string,
  ): Promise<string> {
    const profile = await this.prisma.companyFinancialProfile.findUnique({
      where: { companyId },
      select: { baseCurrencyCode: true },
    });
    const configuredCurrency = profile?.baseCurrencyCode?.trim().toUpperCase();

    if (!configuredCurrency) {
      throw new BadRequestException({
        code: 'COMPANY_CURRENCY_NOT_CONFIGURED',
        message:
          'Configure the Company Financial Profile currency before preparing an offer.',
      });
    }

    const requested = requestedCurrency?.trim().toUpperCase();
    if (requested && requested !== configuredCurrency) {
      throw new BadRequestException({
        code: 'OFFER_CURRENCY_MISMATCH',
        message: `Offer currency must match the Company Financial Profile currency (${configuredCurrency}).`,
      });
    }

    return configuredCurrency;
  }

  private async assertApplicationInScope(applicationId: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id: applicationId,
        ...this.scope.jobApplicationWhere(),
      },
      include: {
        jobOpening: {
          include: {
            company: true,
            branch: true,
            department: true,
            designation: true,
          },
        },
        candidate: true,
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

  private presentOffer(offer: OfferWithRelations) {
    const sanitized = this.sanitizeOffer(offer);
    const latestAttempt = offer.deliveryAttempts[0];
    const deliveryStatus = this.resolveDeliveryStatus(offer, latestAttempt);
    const retryAvailable =
      offer.status === JobOfferStatus.SENT &&
      deliveryStatus === RecruitmentDeliveryStatus.FAILED;

    return {
      ...sanitized,
      candidateResponseUrl: this.resolveCandidateResponseUrl(offer),
      delivery: {
        status: deliveryStatus,
        lastAttemptAt:
          latestAttempt?.processedAt ??
          latestAttempt?.createdAt ??
          offer.sentAt,
        failureReason: latestAttempt?.lastErrorCode ?? undefined,
        retryAvailable,
      },
      allowedActions: {
        canEdit: offer.status === JobOfferStatus.DRAFT,
        canPreview:
          offer.status === JobOfferStatus.DRAFT ||
          offer.status === JobOfferStatus.SENT,
        canSend: offer.status === JobOfferStatus.DRAFT,
        canRetryDelivery: retryAvailable,
        canRevoke: offer.status === JobOfferStatus.SENT,
        canRevise:
          offer.status === JobOfferStatus.SENT ||
          offer.status === JobOfferStatus.REVOKED ||
          offer.status === JobOfferStatus.EXPIRED ||
          offer.status === JobOfferStatus.DECLINED,
      },
    };
  }

  private resolveDeliveryStatus(
    offer: OfferWithRelations,
    latestAttempt?: OfferWithRelations['deliveryAttempts'][number],
  ) {
    if (latestAttempt?.status) {
      return latestAttempt.status;
    }
    if (offer.sentAt) {
      return RecruitmentDeliveryStatus.QUEUED;
    }
    return 'NOT_SENT' as const;
  }

  private resolveCandidateResponseUrl(
    offer: OfferWithRelations,
  ): string | undefined {
    if (this.nodeEnvironment === 'production') {
      return undefined;
    }

    if (
      offer.status !== JobOfferStatus.SENT ||
      !offer.responseTokenCiphertext
    ) {
      return undefined;
    }

    try {
      const token = this.crypto.decrypt(offer.responseTokenCiphertext);
      return `${this.frontendUrl.replace(/\/$/, '')}/offer-response?token=${encodeURIComponent(token)}`;
    } catch {
      return undefined;
    }
  }

  private sanitizeOffer<T extends object>(offer: T) {
    const clone = { ...offer } as T & {
      responseTokenHash?: unknown;
      responseTokenCiphertext?: unknown;
      deliveryAttempts?: unknown;
    };
    delete clone.responseTokenHash;
    delete clone.responseTokenCiphertext;
    delete clone.deliveryAttempts;
    return clone;
  }
}
