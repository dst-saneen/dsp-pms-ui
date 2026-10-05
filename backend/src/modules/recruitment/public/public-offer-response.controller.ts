import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  JobApplicationStatus,
  JobOfferStatus,
  Prisma,
  RecruitmentActorType,
} from '@prisma/client';
import type { Request, Response } from 'express';

import { Public } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from '../../auth/password.service';
import { RecruitmentDocumentService } from '../document/recruitment-document.service';
import { RecruitmentFeatureGateService } from '../services/recruitment-feature-gate.service';
import { RecruitmentOutboxService } from '../services/recruitment-outbox.service';
import { JobApplicationTransitionService } from '../transitions';
import {
  InspectOfferResponseDto,
  OfferDocumentDownloadDto,
  RespondToOfferDto,
} from './dto/public-offer-response.dto';

@ApiTags('Public Offer Response')
@Controller('public/offer-response')
export class PublicOfferResponseController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly documentService: RecruitmentDocumentService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly outbox: RecruitmentOutboxService,
    private readonly recruitmentFeature: RecruitmentFeatureGateService,
  ) {}

  @Public()
  @Get('inspect')
  @ApiOperation({
    summary: 'Inspect an offer response token without consuming it',
  })
  async inspect(@Query() query: InspectOfferResponseDto) {
    const offer = await this.findOfferByToken(query.token);
    if (offer.inspectStatus !== 'VALID') {
      return {
        status: offer.inspectStatus,
        message: offer.message,
      };
    }

    const downloadToken = offer.record.recruitmentDocumentId
      ? await this.documentService.createDownloadToken(
          offer.record.recruitmentDocumentId,
        )
      : undefined;

    return {
      status: 'VALID' as const,
      versionNo: offer.record.versionNo,
      version: offer.record.version,
      offerVersion: offer.record.version,
      responseVersion: offer.record.version,
      candidateName:
        `${offer.record.jobApplication.candidate.firstName} ${offer.record.jobApplication.candidate.lastName ?? ''}`.trim(),
      companyName: offer.record.jobApplication.jobOpening.company.companyName,
      designationName:
        offer.record.jobApplication.jobOpening.designation.designationName,
      joiningDate: offer.record.joiningDate,
      expiryDate: offer.record.expiryDate,
      compensationCurrency: offer.record.compensationCurrency,
      compensationAmount: offer.record.compensationAmount,
      compensationPeriod: offer.record.compensationPeriod,
      termsText: offer.record.termsText,
      downloadToken,
    };
  }

  @Public()
  @Post('accept')
  @ApiOperation({ summary: 'Accept an offer' })
  async accept(@Body() dto: RespondToOfferDto, @Req() request: Request) {
    this.assertAcknowledgement(dto);

    const offer = await this.findSentOffer(dto.token);
    const now = new Date();
    const evidence = this.buildResponseEvidence(request, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.jobOffer.updateMany({
        where: {
          id: offer.id,
          status: JobOfferStatus.SENT,
          responseTokenHash: offer.responseTokenHash,
          responseTokenExpiresAt: { gt: now },
        },
        data: {
          status: JobOfferStatus.ACCEPTED,
          respondedAt: now,
          respondedLegalName: dto.legalName.trim(),
          responseEvidence: evidence,
          responseTokenExpiresAt: now,
          responseTokenCiphertext: null,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException({
          code: 'OFFER_RESPONSE_CONSUMED',
          message: 'This offer link is no longer valid.',
        });
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

      await this.outbox.enqueue(
        tx,
        'recruitment.offer.accepted',
        offer.id,
        {
          companyGroupId: offer.jobApplication.jobOpening.companyGroupId,
          companyId: offer.jobApplication.jobOpening.companyId,
          branchId: offer.jobApplication.jobOpening.branchId,
          jobApplicationId: offer.jobApplicationId,
          jobOpeningId: offer.jobApplication.jobOpeningId,
          jobOfferId: offer.id,
          candidateId: offer.jobApplication.candidateId,
        },
        `recruitment:offer-accepted:${offer.id}`,
      );

      return tx.jobOffer.findUniqueOrThrow({
        where: { id: offer.id },
      });
    });

    return {
      status: updated.status,
      respondedAt: updated.respondedAt,
      message: 'Offer accepted successfully.',
    };
  }

  @Public()
  @Post('decline')
  @ApiOperation({ summary: 'Decline an offer' })
  async decline(@Body() dto: RespondToOfferDto, @Req() request: Request) {
    this.assertAcknowledgement(dto);

    const offer = await this.findSentOffer(dto.token);
    const now = new Date();
    const evidence = this.buildResponseEvidence(request, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.jobOffer.updateMany({
        where: {
          id: offer.id,
          status: JobOfferStatus.SENT,
          responseTokenHash: offer.responseTokenHash,
          responseTokenExpiresAt: { gt: now },
        },
        data: {
          status: JobOfferStatus.DECLINED,
          respondedAt: now,
          respondedLegalName: dto.legalName.trim(),
          responseEvidence: evidence,
          responseTokenExpiresAt: now,
          responseTokenCiphertext: null,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException({
          code: 'OFFER_RESPONSE_CONSUMED',
          message: 'This offer link is no longer valid.',
        });
      }

      await this.releaseHeadcountReservation(
        tx,
        offer.jobApplication.jobOpeningId,
      );

      const application = await tx.jobApplication.findUniqueOrThrow({
        where: { id: offer.jobApplicationId },
      });

      await this.applicationTransitions.transitionInTransaction(
        tx,
        application,
        JobApplicationStatus.OFFER_DECLINED,
        {
          comment: dto.comment,
          actorType: RecruitmentActorType.CANDIDATE,
        },
      );

      await this.outbox.enqueue(
        tx,
        'recruitment.offer.declined',
        offer.id,
        {
          companyGroupId: offer.jobApplication.jobOpening.companyGroupId,
          companyId: offer.jobApplication.jobOpening.companyId,
          branchId: offer.jobApplication.jobOpening.branchId,
          jobApplicationId: offer.jobApplicationId,
          jobOpeningId: offer.jobApplication.jobOpeningId,
          jobOfferId: offer.id,
          candidateId: offer.jobApplication.candidateId,
        },
        `recruitment:offer-declined:${offer.id}`,
      );

      return tx.jobOffer.findUniqueOrThrow({
        where: { id: offer.id },
      });
    });

    return {
      status: updated.status,
      respondedAt: updated.respondedAt,
      message: 'Offer declined successfully.',
    };
  }

  @Public()
  @Post('document-download')
  @ApiOperation({
    summary: 'Download offer PDF using response and download tokens',
  })
  async downloadDocument(
    @Body() dto: OfferDocumentDownloadDto,
    @Res() response: Response,
  ) {
    const offer = await this.findSentOffer(dto.token);

    if (!offer.recruitmentDocumentId) {
      throw new BadRequestException({
        code: 'OFFER_DOCUMENT_UNAVAILABLE',
        message: 'Offer document is unavailable.',
      });
    }

    const documentId = await this.documentService.resolveDownloadToken(
      dto.downloadToken,
    );

    if (documentId !== offer.recruitmentDocumentId) {
      throw new BadRequestException({
        code: 'OFFER_DOCUMENT_MISMATCH',
        message: 'Download token does not match this offer document.',
      });
    }

    const { document, stream } =
      await this.documentService.openDocumentStream(documentId);

    response.setHeader('Content-Type', document.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.displayName}"`,
    );
    stream.pipe(response);
  }

  private assertAcknowledgement(dto: RespondToOfferDto) {
    if (!dto.acknowledgementAccepted || !dto.legalName.trim()) {
      throw new BadRequestException({
        code: 'OFFER_RESPONSE_ACK_REQUIRED',
        message: 'Legal name and acknowledgement are required.',
      });
    }
  }

  private buildResponseEvidence(request: Request, dto: RespondToOfferDto) {
    return {
      legalName: dto.legalName.trim(),
      comment: dto.comment?.trim(),
      ipHash: this.passwordService.hashMetadata(request.ip),
      userAgentHash: this.passwordService.hashMetadata(
        request.headers['user-agent'],
      ),
      respondedAt: new Date().toISOString(),
    };
  }

  private async findSentOffer(token: string) {
    const inspected = await this.findOfferByToken(token);
    if (inspected.inspectStatus !== 'VALID') {
      throw new BadRequestException({
        code: inspected.code,
        message: inspected.message,
      });
    }
    return inspected.record;
  }

  private async findOfferByToken(token: string) {
    const tokenHash = this.passwordService.hashActionToken(
      'offer-response',
      token,
    );
    const now = new Date();

    const offer = await this.prisma.jobOffer.findFirst({
      where: {
        responseTokenHash: tokenHash,
      },
      include: {
        jobApplication: {
          include: {
            candidate: true,
            jobOpening: {
              include: {
                company: true,
                designation: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      return {
        inspectStatus: 'INVALID' as const,
        code: 'OFFER_TOKEN_INVALID',
        message: 'This offer link is invalid or expired.',
        record: null,
      };
    }

    await this.recruitmentFeature.assertEnabledForCompany(
      offer.jobApplication.jobOpening.companyId,
    );

    if (offer.status === JobOfferStatus.ACCEPTED) {
      return {
        inspectStatus: 'ACCEPTED' as const,
        code: 'OFFER_ALREADY_RESPONDED',
        message: 'This offer has already been accepted.',
        record: offer,
      };
    }

    if (offer.status === JobOfferStatus.DECLINED) {
      return {
        inspectStatus: 'DECLINED' as const,
        code: 'OFFER_ALREADY_RESPONDED',
        message: 'This offer has already been declined.',
        record: offer,
      };
    }

    if (offer.status === JobOfferStatus.REVOKED) {
      return {
        inspectStatus: 'REVOKED' as const,
        code: 'OFFER_REVOKED',
        message: 'This offer is no longer available.',
        record: offer,
      };
    }

    if (offer.status === JobOfferStatus.SUPERSEDED) {
      return {
        inspectStatus: 'SUPERSEDED' as const,
        code: 'OFFER_SUPERSEDED',
        message: 'This offer has been replaced.',
        record: offer,
      };
    }

    if (
      offer.status === JobOfferStatus.EXPIRED ||
      (offer.responseTokenExpiresAt && offer.responseTokenExpiresAt <= now) ||
      offer.expiryDate <= now
    ) {
      return {
        inspectStatus: 'EXPIRED' as const,
        code: 'OFFER_TOKEN_EXPIRED',
        message: 'This offer link has expired.',
        record: offer,
      };
    }

    if (offer.status !== JobOfferStatus.SENT) {
      return {
        inspectStatus: 'INVALID' as const,
        code: 'OFFER_TOKEN_INVALID',
        message: 'This offer link is invalid or expired.',
        record: offer,
      };
    }

    return {
      inspectStatus: 'VALID' as const,
      code: 'OFFER_VALID',
      message: 'Offer is available.',
      record: offer,
    };
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
}
