import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  FileObjectStatus,
  FileUploadPurpose,
  FileUploadSessionStatus,
  JobApplicationStatus,
  JobOfferStatus,
  OfferSignatureSubmissionStatus,
  Prisma,
  RecruitmentActorType,
  RecruitmentDocumentKind,
  UserStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from '../../auth/password.service';
import {
  OutboxWriterService,
  PrismaTx,
} from '../../outbox/outbox-writer.service';
import { JobApplicationTransitionService } from '../../recruitment/transitions';
import { RecruitmentCryptoService } from '../../recruitment/core/recruitment-crypto.service';
import { RecruitmentDomainScopeService } from '../../recruitment/core/recruitment-domain-scope.service';
import { commandRequestDigest } from '../file-storage.crypto';
import { FileCommandReceiptService } from './file-command-receipt.service';
import { FileStorageFeatureService } from './file-storage-feature.service';
import { FileUploadSessionService } from './file-upload-session.service';
import { PublicOfferTokenContext } from './public-offer-token.service';

export interface AcceptOfferWithSignedDocumentInput {
  tokenContext: PublicOfferTokenContext;
  legalName: string;
  declarationAccepted: true;
  uploadSessionId: string;
  expectedOfferVersion: number;
  operationId: string;
  evidence: Record<string, unknown>;
}

export interface DecideOfferSignatureInput {
  submissionId: string;
  jobOfferId: string;
  companyId: string;
  actorUserId: string;
  expectedOfferVersion: number;
  expectedSubmissionVersion: number;
  operationId: string;
  reason: string;
  decision: 'VERIFY' | 'REJECT';
}

export interface SignedOfferReadiness {
  required: true;
  status: 'NOT_SUBMITTED' | 'PENDING_VERIFICATION' | 'REJECTED' | 'VERIFIED';
  submissionId: string | null;
  fileStatus: string | null;
  verifiedAt: string | null;
  blockingCode: string | null;
}

const SUBMISSION_ALLOWED: Record<OfferSignatureSubmissionStatus, string[]> = {
  PENDING_VERIFICATION: ['VERIFY', 'REJECT', 'DOWNLOAD'],
  VERIFIED: ['DOWNLOAD'],
  REJECTED: ['DOWNLOAD', 'REQUEST_RESUBMISSION'],
  SUPERSEDED: ['DOWNLOAD'],
};

@Injectable()
export class OfferSignatureService {
  private readonly logger = new Logger(OfferSignatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: FileUploadSessionService,
    private readonly receipts: FileCommandReceiptService,
    private readonly features: FileStorageFeatureService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly recruitmentScope: RecruitmentDomainScopeService,
    private readonly passwordService: PasswordService,
    private readonly crypto: RecruitmentCryptoService,
    @Inject(forwardRef(() => OutboxWriterService))
    private readonly outbox: OutboxWriterService,
  ) {}

  async createOfferUploadSession(
    context: PublicOfferTokenContext,
    sessionInput: {
      fileName: string;
      declaredMimeType: string;
      sizeBytes: number;
      checksumSha256: string;
      operationId: string;
    },
  ) {
    await this.assertSignedOfferWorkflowAllowed(
      context.companyId,
      context.branchId,
    );
    return this.sessionService.createSession({
      companyId: context.companyId,
      branchId: context.branchId,
      purpose: FileUploadPurpose.SIGNED_OFFER,
      jobOfferId: context.jobOfferId,
      jobApplicationId: context.jobApplicationId,
      fileName: sessionInput.fileName,
      declaredMimeType: sessionInput.declaredMimeType,
      sizeBytes: sessionInput.sizeBytes,
      checksumSha256: sessionInput.checksumSha256,
      operationId: sessionInput.operationId,
      issuePublicSessionToken: true,
    });
  }

  /**
   * Exposed for public-token routes which use FileUploadSessionService
   * directly. Signed offers are never File Storage-only traffic: Recruitment
   * entitlement and active-company state must still be live.
   */
  async assertSignedOfferWorkflowAllowed(
    companyId: string,
    branchId: string | null,
  ): Promise<void> {
    await this.features.assertSignedOfferWorkflowAllowed(companyId, branchId);
  }

  async acceptWithSignedDocument(input: AcceptOfferWithSignedDocumentInput) {
    await this.assertSignedOfferWorkflowAllowed(
      input.tokenContext.companyId,
      input.tokenContext.branchId,
    );

    const digest = commandRequestDigest('accept-with-signed-document', {
      uploadSessionId: input.uploadSessionId,
      expectedOfferVersion: input.expectedOfferVersion,
      legalName: input.legalName,
    });

    return this.prisma.$transaction(async (tx) => {
      const replay = await this.receipts.claimOrReplay<{
        submissionId: string;
        status: string;
        message: string;
        offerStatus: string;
        applicationStatus: string;
      }>(tx, {
        companyId: input.tokenContext.companyId,
        operationId: input.operationId,
        commandType: 'accept-with-signed-document',
        requestDigest: digest,
        publicContext: input.tokenContext.tokenKind,
      });
      if (replay.replay) {
        return replay.response;
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM job_offers WHERE id = ${input.tokenContext.jobOfferId} AND "companyId" = ${input.tokenContext.companyId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM job_applications WHERE id = ${input.tokenContext.jobApplicationId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM file_upload_sessions WHERE id = ${input.uploadSessionId} FOR UPDATE`,
      );

      // Re-evaluate the live Company entitlement at the last safe boundary
      // before this public flow mutates an offer, application, or signature.
      await this.assertSignedOfferWorkflowAllowed(
        input.tokenContext.companyId,
        input.tokenContext.branchId,
      );

      const offer = await tx.jobOffer.findFirst({
        where: {
          id: input.tokenContext.jobOfferId,
          companyId: input.tokenContext.companyId,
        },
      });
      if (!offer) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
      }
      const expectedMatchesLock = offer.version === input.expectedOfferVersion;
      const expectedMatchesDocument =
        offer.versionNo === input.expectedOfferVersion;
      if (!expectedMatchesLock && !expectedMatchesDocument) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }

      const isResubmission = input.tokenContext.tokenKind === 'RESUBMISSION';
      if (isResubmission) {
        if (offer.status !== JobOfferStatus.ACCEPTED) {
          throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
        }
      } else if (offer.status !== JobOfferStatus.SENT) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }

      const session = await tx.fileUploadSession.findFirst({
        where: {
          id: input.uploadSessionId,
          companyId: input.tokenContext.companyId,
          jobOfferId: offer.id,
          purpose: FileUploadPurpose.SIGNED_OFFER,
        },
        include: { fileObject: true },
      });
      if (!session?.fileObject) {
        throw new NotFoundException({ code: 'SIGNED_OFFER_REQUIRED' });
      }
      if (
        session.status !== FileUploadSessionStatus.CLEAN ||
        session.fileObject.status !== FileObjectStatus.CLEAN
      ) {
        throw new BadRequestException({
          code:
            session.status === FileUploadSessionStatus.UPLOADED ||
            session.status === FileUploadSessionStatus.FINALIZING
              ? 'SIGNED_OFFER_SCAN_PENDING'
              : 'SIGNED_OFFER_REQUIRED',
        });
      }
      if (
        session.fileObject.detectedMimeType !== 'application/pdf' ||
        session.fileObject.safeExtension !== 'pdf'
      ) {
        throw new BadRequestException({ code: 'FILE_TYPE_MISMATCH' });
      }
      if (
        session.fileObject.deletionRequestedAt ||
        session.fileObject.deletionCompletedAt ||
        session.expiresAt < new Date()
      ) {
        throw new BadRequestException({ code: 'SIGNED_OFFER_REQUIRED' });
      }
      if (session.branchId !== offer.branchId) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM file_objects WHERE id = ${session.fileObject.id} FOR UPDATE`,
      );

      const pending = await tx.offerSignatureSubmission.findFirst({
        where: {
          jobOfferId: offer.id,
          status: OfferSignatureSubmissionStatus.PENDING_VERIFICATION,
        },
      });
      if (pending) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }

      const last = await tx.offerSignatureSubmission.findFirst({
        where: { jobOfferId: offer.id },
        orderBy: { submissionNo: 'desc' },
      });
      const submissionNo = (last?.submissionNo ?? 0) + 1;
      const now = new Date();

      const recruitmentDoc = await tx.recruitmentDocument.create({
        data: {
          companyId: offer.companyId,
          branchId: offer.branchId,
          jobOfferId: offer.id,
          jobApplicationId: offer.jobApplicationId,
          fileObjectId: session.fileObject.id,
          kind: RecruitmentDocumentKind.OFFER_PDF,
          originalFileName: session.expectedFileName,
          displayName: `Signed Offer - ${input.legalName}`,
          mimeType: session.fileObject.detectedMimeType ?? 'application/pdf',
          fileSize:
            session.fileObject.actualSizeBytes ??
            session.fileObject.expectedSizeBytes,
          checksumSha256:
            session.fileObject.actualChecksumSha256 ??
            session.fileObject.expectedChecksumSha256,
          storageKey: session.fileObject.objectKey,
          scanStatus: 'CLEAN',
          scannedAt: session.fileObject.scannedAt,
          version: 0,
        },
      });

      if (last?.status === OfferSignatureSubmissionStatus.REJECTED) {
        // superseded pointer is set after the new row exists
      }

      const submission = await tx.offerSignatureSubmission.create({
        data: {
          companyId: offer.companyId,
          branchId: offer.branchId,
          jobOfferId: offer.id,
          jobApplicationId: offer.jobApplicationId,
          submissionNo,
          recruitmentDocumentId: recruitmentDoc.id,
          fileObjectId: session.fileObject.id,
          candidateLegalName: input.legalName,
          declarationAcceptedAt: now,
          status: OfferSignatureSubmissionStatus.PENDING_VERIFICATION,
          version: 0,
        },
      });

      if (last?.status === OfferSignatureSubmissionStatus.REJECTED) {
        await tx.offerSignatureSubmission.update({
          where: { id: last.id },
          data: {
            status: OfferSignatureSubmissionStatus.SUPERSEDED,
            supersededBySubmissionId: submission.id,
            version: { increment: 1 },
          },
        });
      }

      if (!isResubmission) {
        const consumed = await tx.jobOffer.updateMany({
          where: {
            id: offer.id,
            status: JobOfferStatus.SENT,
            version: offer.version,
          },
          data: {
            status: JobOfferStatus.ACCEPTED,
            respondedAt: now,
            respondedLegalName: input.legalName.trim(),
            responseEvidence: input.evidence as Prisma.InputJsonValue,
            responseTokenExpiresAt: now,
            responseTokenCiphertext: null,
            version: { increment: 1 },
          },
        });
        if (consumed.count !== 1) {
          throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
        }

        const application = await tx.jobApplication.findUniqueOrThrow({
          where: { id: offer.jobApplicationId },
        });
        await this.applicationTransitions.transitionInTransaction(
          tx,
          application,
          JobApplicationStatus.OFFER_ACCEPTED,
          {
            offerAcceptedAt: now,
            actorType: RecruitmentActorType.CANDIDATE,
          },
        );
      } else {
        await tx.jobOffer.update({
          where: { id: offer.id },
          data: {
            signatureResubmissionTokenHash: null,
            signatureResubmissionTokenCiphertext: null,
            signatureResubmissionExpiresAt: now,
            version: { increment: 1 },
          },
        });
      }

      await this.enqueueSignatureEvent(
        tx,
        'recruitment.offer.signature.submitted',
        submission.id,
        offer.id,
        `recruitment:offer-signature-submitted:${submission.id}`,
      );

      const response = {
        submissionId: submission.id,
        status: 'PENDING_VERIFICATION',
        offerStatus: JobOfferStatus.ACCEPTED,
        applicationStatus: JobApplicationStatus.OFFER_ACCEPTED,
        message: 'Offer accepted - HR verification pending',
      };

      await this.receipts.store(tx, {
        companyId: offer.companyId,
        operationId: input.operationId,
        commandType: 'accept-with-signed-document',
        requestDigest: digest,
        response,
        publicContext: input.tokenContext.tokenKind,
      });

      return response;
    });
  }

  async getSubmissions(jobOfferId: string, companyId: string) {
    await this.assertSignedOfferWorkflowAllowed(companyId, null);
    await this.recruitmentScope.assertJobOfferInScope(jobOfferId, companyId);
    const submissions = await this.prisma.offerSignatureSubmission.findMany({
      where: { jobOfferId, companyId },
      orderBy: { submissionNo: 'desc' },
      include: {
        fileObject: { select: { id: true, status: true, safeExtension: true } },
      },
    });

    return submissions.map((s) => ({
      id: s.id,
      submissionNo: s.submissionNo,
      version: s.version,
      recruitmentDocumentId: s.recruitmentDocumentId,
      status: s.status,
      candidateLegalName: s.candidateLegalName,
      submittedAt: s.submittedAt,
      verifiedAt: s.verifiedAt ?? null,
      rejectedAt: s.rejectedAt ?? null,
      rejectionReason: s.rejectionReason ?? null,
      fileStatus: s.fileObject?.status ?? null,
      allowedActions: SUBMISSION_ALLOWED[s.status] ?? [],
    }));
  }

  async getSubmission(
    submissionId: string,
    jobOfferId: string,
    companyId: string,
  ) {
    await this.assertSignedOfferWorkflowAllowed(companyId, null);
    await this.recruitmentScope.assertJobOfferInScope(jobOfferId, companyId);
    const submission = await this.prisma.offerSignatureSubmission.findFirst({
      where: { id: submissionId, jobOfferId, companyId },
      include: {
        fileObject: { select: { id: true, status: true, safeExtension: true } },
      },
    });
    if (!submission) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    return {
      id: submission.id,
      submissionNo: submission.submissionNo,
      version: submission.version,
      recruitmentDocumentId: submission.recruitmentDocumentId,
      status: submission.status,
      candidateLegalName: submission.candidateLegalName,
      submittedAt: submission.submittedAt,
      verifiedAt: submission.verifiedAt ?? null,
      rejectedAt: submission.rejectedAt ?? null,
      rejectionReason: submission.rejectionReason ?? null,
      fileStatus: submission.fileObject?.status ?? null,
      allowedActions: SUBMISSION_ALLOWED[submission.status] ?? [],
    };
  }

  async decide(input: DecideOfferSignatureInput) {
    await this.assertSignedOfferWorkflowAllowed(input.companyId, null);
    await this.recruitmentScope.assertJobOfferInScope(
      input.jobOfferId,
      input.companyId,
    );
    if (!this.features.signedOfferEnabled()) {
      throw new ForbiddenException({
        code: 'OFFER_VERIFICATION_PERMISSION_REQUIRED',
      });
    }

    const digest = commandRequestDigest(`signature-${input.decision}`, {
      submissionId: input.submissionId,
      expectedOfferVersion: input.expectedOfferVersion,
      expectedSubmissionVersion: input.expectedSubmissionVersion,
      reason: input.reason,
    });

    return this.prisma.$transaction(async (tx) => {
      const replay = await this.receipts.claimOrReplay<{
        status: string;
        message: string;
      }>(tx, {
        companyId: input.companyId,
        operationId: input.operationId,
        commandType: `signature-${input.decision}`,
        requestDigest: digest,
        actorUserId: input.actorUserId,
      });
      if (replay.replay) {
        return replay.response;
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM job_offers WHERE id = ${input.jobOfferId} AND "companyId" = ${input.companyId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM offer_signature_submissions WHERE id = ${input.submissionId} FOR UPDATE`,
      );

      await this.assertSignedOfferWorkflowAllowed(input.companyId, null);
      await this.recruitmentScope.assertJobOfferInScope(
        input.jobOfferId,
        input.companyId,
      );

      const offer = await tx.jobOffer.findFirst({
        where: { id: input.jobOfferId, companyId: input.companyId },
      });
      if (!offer) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
      }
      if (offer.version !== input.expectedOfferVersion) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }

      const submission = await tx.offerSignatureSubmission.findFirst({
        where: {
          id: input.submissionId,
          jobOfferId: input.jobOfferId,
          companyId: input.companyId,
        },
        include: { fileObject: true },
      });
      if (!submission) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
      }
      if (submission.version !== input.expectedSubmissionVersion) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }
      if (
        submission.status !==
        OfferSignatureSubmissionStatus.PENDING_VERIFICATION
      ) {
        if (submission.status === OfferSignatureSubmissionStatus.VERIFIED) {
          throw new ConflictException({
            code: 'SIGNED_OFFER_ALREADY_VERIFIED',
          });
        }
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }
      if (submission.fileObject?.status !== FileObjectStatus.CLEAN) {
        throw new BadRequestException({ code: 'SIGNED_OFFER_SCAN_PENDING' });
      }

      if (input.decision === 'VERIFY') {
        await tx.offerSignatureSubmission.update({
          where: { id: submission.id },
          data: {
            status: OfferSignatureSubmissionStatus.VERIFIED,
            verifiedByUserId: input.actorUserId,
            verifiedAt: new Date(),
            verificationNote: input.reason,
            version: { increment: 1 },
          },
        });
        await tx.jobOffer.update({
          where: { id: offer.id },
          data: { version: { increment: 1 } },
        });
        await this.enqueueSignatureEvent(
          tx,
          'recruitment.offer.signature.verified',
          submission.id,
          input.jobOfferId,
          `recruitment:offer-signature-verified:${submission.id}`,
        );
        const response = {
          status: 'VERIFIED',
          message: 'Signed offer verified successfully',
        };
        await this.receipts.store(tx, {
          companyId: input.companyId,
          operationId: input.operationId,
          commandType: 'signature-VERIFY',
          requestDigest: digest,
          response,
          actorUserId: input.actorUserId,
        });
        return response;
      }

      if (!input.reason?.trim()) {
        throw new BadRequestException({ code: 'SIGNED_OFFER_REQUIRED' });
      }
      await tx.offerSignatureSubmission.update({
        where: { id: submission.id },
        data: {
          status: OfferSignatureSubmissionStatus.REJECTED,
          rejectedByUserId: input.actorUserId,
          rejectedAt: new Date(),
          rejectionReason: input.reason,
          version: { increment: 1 },
        },
      });
      await tx.jobOffer.update({
        where: { id: offer.id },
        data: { version: { increment: 1 } },
      });
      await this.enqueueSignatureEvent(
        tx,
        'recruitment.offer.signature.rejected',
        submission.id,
        input.jobOfferId,
        `recruitment:offer-signature-rejected:${submission.id}`,
      );
      const response = { status: 'REJECTED', message: 'Signed offer rejected' };
      await this.receipts.store(tx, {
        companyId: input.companyId,
        operationId: input.operationId,
        commandType: 'signature-REJECT',
        requestDigest: digest,
        response,
        actorUserId: input.actorUserId,
      });
      return response;
    });
  }

  async requestSignatureResubmission(input: {
    jobOfferId: string;
    companyId: string;
    actorUserId: string;
    operationId: string;
    reason: string;
    expectedOfferVersion: number;
  }) {
    await this.assertSignedOfferWorkflowAllowed(input.companyId, null);
    await this.recruitmentScope.assertJobOfferInScope(
      input.jobOfferId,
      input.companyId,
    );
    if (!input.reason?.trim()) {
      throw new BadRequestException({ code: 'SIGNED_OFFER_REQUIRED' });
    }
    const digest = commandRequestDigest('request-signature-resubmission', {
      jobOfferId: input.jobOfferId,
      expectedOfferVersion: input.expectedOfferVersion,
      reason: input.reason,
    });

    return this.prisma.$transaction(async (tx) => {
      const replay = await this.receipts.claimOrReplay<{
        status: string;
        message: string;
      }>(tx, {
        companyId: input.companyId,
        operationId: input.operationId,
        commandType: 'request-signature-resubmission',
        requestDigest: digest,
        actorUserId: input.actorUserId,
      });
      if (replay.replay) {
        return replay.response;
      }

      const offer = await tx.jobOffer.findFirst({
        where: { id: input.jobOfferId, companyId: input.companyId },
      });
      if (!offer) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
      }
      await this.assertSignedOfferWorkflowAllowed(
        offer.companyId,
        offer.branchId,
      );
      await this.recruitmentScope.assertJobOfferInScope(
        offer.id,
        offer.companyId,
      );
      if (offer.version !== input.expectedOfferVersion) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }

      const rejected = await tx.offerSignatureSubmission.findFirst({
        where: {
          jobOfferId: offer.id,
          status: OfferSignatureSubmissionStatus.REJECTED,
        },
        orderBy: { submissionNo: 'desc' },
      });
      if (!rejected) {
        throw new ConflictException({ code: 'SIGNED_OFFER_STATE_CHANGED' });
      }

      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = this.passwordService.hashActionToken(
        'offer-signature-resubmission',
        token,
      );
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.jobOffer.update({
        where: { id: offer.id },
        data: {
          signatureResubmissionTokenHash: tokenHash,
          signatureResubmissionTokenCiphertext: this.crypto.encrypt(token),
          signatureResubmissionExpiresAt: expiresAt,
          version: { increment: 1 },
        },
      });

      await this.enqueueSignatureEvent(
        tx,
        'recruitment.offer.signature.resubmission.requested',
        rejected.id,
        offer.id,
        `recruitment:offer-signature-resubmission:${rejected.id}:${input.operationId}`,
      );

      const response = {
        status: 'RESUBMISSION_REQUESTED',
        message: 'Candidate resubmission link will be delivered.',
      };
      await this.receipts.store(tx, {
        companyId: input.companyId,
        operationId: input.operationId,
        commandType: 'request-signature-resubmission',
        requestDigest: digest,
        response,
        actorUserId: input.actorUserId,
      });
      return response;
    });
  }

  async getSignedOfferReadiness(
    jobOfferId: string,
    companyId: string,
  ): Promise<SignedOfferReadiness> {
    await this.assertSignedOfferWorkflowAllowed(companyId, null);
    const submission = await this.prisma.offerSignatureSubmission.findFirst({
      where: { jobOfferId, companyId },
      orderBy: { submissionNo: 'desc' },
      include: { fileObject: { select: { status: true } } },
    });

    if (!submission) {
      return {
        required: true,
        status: 'NOT_SUBMITTED',
        submissionId: null,
        fileStatus: null,
        verifiedAt: null,
        blockingCode: 'SIGNED_OFFER_REQUIRED',
      };
    }

    const statusMap: Record<
      OfferSignatureSubmissionStatus,
      SignedOfferReadiness['status']
    > = {
      [OfferSignatureSubmissionStatus.PENDING_VERIFICATION]:
        'PENDING_VERIFICATION',
      [OfferSignatureSubmissionStatus.VERIFIED]: 'VERIFIED',
      [OfferSignatureSubmissionStatus.REJECTED]: 'REJECTED',
      [OfferSignatureSubmissionStatus.SUPERSEDED]: 'REJECTED',
    };

    return {
      required: true,
      status: statusMap[submission.status],
      submissionId: submission.id,
      fileStatus: submission.fileObject?.status ?? null,
      verifiedAt: submission.verifiedAt?.toISOString() ?? null,
      blockingCode:
        submission.status === OfferSignatureSubmissionStatus.VERIFIED
          ? null
          : 'SIGNED_OFFER_NOT_VERIFIED',
    };
  }

  async assertConversionAllowed(
    jobOfferId: string,
    companyId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<void> {
    await this.assertSignedOfferWorkflowAllowed(companyId, null);
    const submission = await client.offerSignatureSubmission.findFirst({
      where: {
        jobOfferId,
        companyId,
        status: OfferSignatureSubmissionStatus.VERIFIED,
      },
      include: { fileObject: true },
    });
    if (
      !submission ||
      submission.fileObject?.status !== FileObjectStatus.CLEAN
    ) {
      throw new ForbiddenException({
        code: 'SIGNED_OFFER_NOT_VERIFIED',
      });
    }
  }

  private async enqueueSignatureEvent(
    tx: PrismaTx,
    eventType:
      | 'recruitment.offer.signature.submitted'
      | 'recruitment.offer.signature.verified'
      | 'recruitment.offer.signature.rejected'
      | 'recruitment.offer.signature.resubmission.requested',
    submissionId: string,
    jobOfferId: string,
    dedupeKey: string,
  ): Promise<void> {
    const offer = await tx.jobOffer.findUnique({
      where: { id: jobOfferId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        jobApplicationId: true,
        jobApplication: {
          select: {
            candidateId: true,
            jobOpening: {
              select: { id: true, companyGroupId: true },
            },
          },
        },
      },
    });

    if (!offer) {
      this.logger.warn({
        event: 'offer.signature.outbox.skipped',
        jobOfferId,
        eventType,
      });
      return;
    }

    let recipientUserIds: string[] | undefined;
    if (eventType === 'recruitment.offer.signature.submitted') {
      const users = await tx.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          roleAssignments: {
            some: {
              isActive: true,
              role: {
                permissions: {
                  some: { permission: { code: 'recruitment.offer.verify' } },
                },
              },
              OR: [
                { companyId: offer.companyId },
                { branchId: offer.branchId },
                {
                  companyGroupId:
                    offer.jobApplication.jobOpening.companyGroupId,
                },
                { scope: 'GLOBAL' },
              ],
            },
          },
        },
        select: { id: true },
        take: 200,
      });
      recipientUserIds = [...new Set(users.map((user) => user.id))];
    }

    await this.outbox.write(tx, {
      aggregateType: 'recruitment',
      aggregateId: submissionId,
      eventType,
      dedupeKey,
      companyGroupId: offer.jobApplication.jobOpening.companyGroupId,
      companyId: offer.companyId,
      branchId: offer.branchId,
      payload: {
        eventCode: eventType,
        jobOfferId: offer.id,
        jobApplicationId: offer.jobApplicationId,
        jobOpeningId: offer.jobApplication.jobOpening.id,
        candidateId: offer.jobApplication.candidateId,
        submissionId,
        ...(recipientUserIds ? { recipientUserIds } : {}),
      },
    });
  }
}
