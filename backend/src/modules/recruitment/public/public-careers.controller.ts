import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApplicationSource,
  JobApplicationStatus,
  RecruitmentActorType,
  RecruitmentDocumentKind,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';

import { Public } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecruitmentDocumentService } from '../document/recruitment-document.service';
import { PublicCareersEnabledGuard } from '../guards/recruitment-feature.guard';
import { RecruitmentOutboxService } from '../services/recruitment-outbox.service';
import { SubmitCareerApplicationDto } from './dto/public-careers.dto';
import { PublicCareersAbuseService } from './public-careers-abuse.service';
import { PublicCareerOpeningService } from './public-career-opening.service';

const PUBLIC_UPLOAD_LIMITS = {
  fileSize: 10 * 1024 * 1024,
  files: 6,
};

@ApiTags('Public Careers')
@Public()
@UseGuards(PublicCareersEnabledGuard)
@Controller('public/careers')
export class PublicCareersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: RecruitmentDocumentService,
    private readonly outbox: RecruitmentOutboxService,
    private readonly abuse: PublicCareersAbuseService,
    private readonly openings: PublicCareerOpeningService,
  ) {}

  @Public()
  @Get(':companyCode')
  @ApiOperation({ summary: 'List published openings for a company' })
  async listOpenings(@Param('companyCode') companyCode: string) {
    const { company, openings } = await this.openings.listOpenings(companyCode);

    return {
      company: {
        companyCode: company.companyCode,
        companyName: company.companyName,
      },
      openings,
    };
  }

  @Public()
  @Get(':companyCode/jobs/:openingCode')
  @ApiOperation({ summary: 'Get a published opening detail' })
  async getOpening(
    @Param('companyCode') companyCode: string,
    @Param('openingCode') openingCode: string,
  ) {
    const { company, opening } =
      await this.openings.resolveOpeningByCompanyCode(companyCode, openingCode);
    const criteria = await this.prisma.jobOpeningCriterion.findMany({
      where: { jobOpeningId: opening.id, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        name: true,
        description: true,
        isRequired: true,
      },
    });

    return {
      company: {
        companyCode: company.companyCode,
        companyName: company.companyName,
      },
      opening: {
        openingCode: opening.openingCode,
        title: opening.title,
        description: opening.description,
        employmentType: opening.employmentType,
        location: opening.location,
        applicationDeadline: opening.applicationDeadline,
        publishedAt: opening.publishedAt,
        department: opening.department,
        designation: opening.designation,
        criteria,
      },
    };
  }

  @Public()
  @Post(':companyCode/jobs/:openingCode/applications')
  @ApiOperation({ summary: 'Submit a public careers application' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cv', maxCount: 1 },
        { name: 'supportingDocuments', maxCount: 5 },
      ],
      { limits: PUBLIC_UPLOAD_LIMITS },
    ),
  )
  async submitApplication(
    @Param('companyCode') companyCode: string,
    @Param('openingCode') openingCode: string,
    @Req() request: Request,
    @UploadedFiles()
    files?: {
      cv?: Express.Multer.File[];
      supportingDocuments?: Express.Multer.File[];
    },
  ) {
    const dto = this.parseApplicationBody(
      request.body as Record<string, unknown>,
    );
    const cvFile = files?.cv?.[0];
    const supportingFiles = files?.supportingDocuments ?? [];
    const body = request.body as Record<string, unknown>;
    const honeypot = this.abuse.parseHoneypot(body);
    const idempotencyKey = this.readString(body.idempotencyKey)?.slice(0, 128);
    const turnstileToken = this.readString(body.turnstileToken);

    if (this.abuse.isHoneypotTriggered(honeypot)) {
      return this.abuse.honeypotResponse();
    }

    if (!dto.privacyAcknowledged) {
      throw new BadRequestException({
        code: 'PRIVACY_ACK_REQUIRED',
        message: 'Privacy acknowledgement is required.',
      });
    }

    if (!cvFile?.buffer?.length) {
      throw new BadRequestException({
        code: 'CV_REQUIRED',
        message: 'CV upload is required.',
      });
    }

    const { company, opening } =
      await this.openings.resolveOpeningByCompanyCode(companyCode, openingCode);
    const companyGroupId = opening.companyGroupId;

    await this.abuse.verifyTurnstile(turnstileToken, request.ip);

    this.documentService.validateUploadMetadata(
      cvFile.originalname,
      cvFile.mimetype,
      cvFile.buffer.length,
    );
    this.documentService.validateFileSignature(cvFile.buffer, cvFile.mimetype);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedMobile = dto.mobile?.replace(/\D/g, '') || null;
    const now = new Date();

    await this.abuse.enforceRateLimit({
      ip: request.ip,
      email: normalizedEmail,
      openingId: opening.id,
    });

    if (idempotencyKey) {
      const replay = await this.prisma.publicApplicationIdempotency.findUnique({
        where: {
          companyId_jobOpeningId_idempotencyKey: {
            companyId: company.id,
            jobOpeningId: opening.id,
            idempotencyKey,
          },
        },
      });
      if (replay) {
        return replay.responsePayload;
      }
    }

    const existingApplication = await this.prisma.jobApplication.findFirst({
      where: {
        jobOpeningId: opening.id,
        candidate: {
          companyGroupId,
          normalizedEmail,
        },
      },
      include: {
        documents: {
          where: { kind: RecruitmentDocumentKind.CV },
          select: { id: true, scanStatus: true },
        },
      },
    });

    if (existingApplication) {
      const hasCleanCv = existingApplication.documents.some(
        (document) => document.scanStatus === 'CLEAN',
      );
      if (!hasCleanCv) {
        await this.documentService.storeUpload({
          buffer: cvFile.buffer,
          originalFileName: cvFile.originalname,
          declaredMimeType: cvFile.mimetype,
          kind: RecruitmentDocumentKind.CV,
          candidateId: existingApplication.candidateId,
          jobApplicationId: existingApplication.id,
        });
      }

      return {
        applicationCode: 'RECEIVED',
        status: 'RECEIVED',
        submittedAt: existingApplication.submittedAt ?? now,
        message:
          'If your details match our records, your application has been received.',
      };
    }

    const applicationCode = `APP-${opening.openingCode}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.upsert({
        where: {
          companyGroupId_normalizedEmail: {
            companyGroupId,
            normalizedEmail,
          },
        },
        create: {
          companyGroupId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim(),
          email: dto.email.trim(),
          normalizedEmail,
          mobile: dto.mobile?.trim(),
          normalizedMobile: normalizedMobile ?? undefined,
          source: ApplicationSource.PUBLIC_CAREERS,
        },
        update: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim(),
          mobile: dto.mobile?.trim(),
          normalizedMobile: normalizedMobile ?? undefined,
        },
      });

      const application = await tx.jobApplication.create({
        data: {
          applicationCode,
          candidateId: candidate.id,
          jobOpeningId: opening.id,
          source: ApplicationSource.PUBLIC_CAREERS,
          status: JobApplicationStatus.APPLIED,
          coverNote: dto.coverNote?.trim(),
          privacyAcknowledgedAt: now,
          privacyAckVersion: dto.privacyAckVersion,
          submittedAt: now,
        },
      });

      await tx.jobApplicationStatusHistory.create({
        data: {
          jobApplicationId: application.id,
          toStatus: JobApplicationStatus.APPLIED,
          actorType: RecruitmentActorType.CANDIDATE,
        },
      });

      await this.outbox.enqueue(
        tx,
        'recruitment.application.received',
        application.id,
        {
          companyGroupId,
          companyId: company.id,
          branchId: opening.branchId,
          jobApplicationId: application.id,
          jobOpeningId: opening.id,
          candidateId: candidate.id,
        },
        `recruitment:application-received:${application.id}`,
      );

      return { candidate, application };
    });

    await this.documentService.storeUpload({
      buffer: cvFile.buffer,
      originalFileName: cvFile.originalname,
      declaredMimeType: cvFile.mimetype,
      kind: RecruitmentDocumentKind.CV,
      candidateId: result.candidate.id,
      jobApplicationId: result.application.id,
    });

    for (const file of supportingFiles) {
      if (!file.buffer?.length) {
        continue;
      }

      await this.documentService.storeUpload({
        buffer: file.buffer,
        originalFileName: file.originalname,
        declaredMimeType: file.mimetype,
        kind: RecruitmentDocumentKind.SUPPORTING,
        candidateId: result.candidate.id,
        jobApplicationId: result.application.id,
      });
    }

    const response = {
      applicationCode: result.application.applicationCode,
      status: result.application.status,
      submittedAt: result.application.submittedAt?.toISOString() ?? null,
    };

    if (idempotencyKey) {
      await this.prisma.publicApplicationIdempotency
        .create({
          data: {
            companyId: company.id,
            jobOpeningId: opening.id,
            idempotencyKey,
            jobApplicationId: result.application.id,
            responsePayload: response,
          },
        })
        .catch(() => undefined);
    }

    return response;
  }

  private parseApplicationBody(
    body: Record<string, unknown>,
  ): SubmitCareerApplicationDto {
    return {
      firstName: this.readString(body.firstName) ?? '',
      lastName: this.readString(body.lastName),
      email: this.readString(body.email) ?? '',
      mobile: this.readString(body.mobile),
      coverNote: this.readString(body.coverNote),
      privacyAcknowledged:
        body.privacyAcknowledged === true ||
        body.privacyAcknowledged === 'true' ||
        body.privacyAcknowledged === '1',
      privacyAckVersion: this.readString(body.privacyAckVersion),
    };
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
