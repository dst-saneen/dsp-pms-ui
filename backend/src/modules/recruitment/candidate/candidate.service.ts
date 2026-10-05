import { ConflictException, Injectable } from '@nestjs/common';
import {
  ApplicationSource,
  Prisma,
  RecruitmentDocumentKind,
} from '@prisma/client';

import { getRequestActor } from '../../../common/context/request-context';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecruitmentDocumentService } from '../document/recruitment-document.service';
import { JobApplicationTransitionService } from '../transitions';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';

import { InternalCandidateIntakeDto } from './dto/internal-intake.dto';
import { SearchCandidateDto } from './dto/search-candidate.dto';

const candidateListInclude = (
  applicationWhere: Prisma.JobApplicationWhereInput,
) =>
  ({
    applications: {
      where: applicationWhere,
      include: {
        jobOpening: {
          select: {
            id: true,
            openingCode: true,
            title: true,
            status: true,
          },
        },
      },
    },
  }) satisfies Prisma.CandidateInclude;

@Injectable()
export class CandidateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly documentService: RecruitmentDocumentService,
  ) {}

  async findAll(query: SearchCandidateDto) {
    const where: Prisma.CandidateWhereInput = {
      ...this.scope.candidateWhere(),
    };

    if (query.companyGroupId) {
      where.companyGroupId = query.companyGroupId;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        include: candidateListInclude(this.scope.jobApplicationWhere()),
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id,
        ...this.scope.candidateWhere(),
      },
      include: candidateListInclude(this.scope.jobApplicationWhere()),
    });

    if (!candidate) {
      this.scope.notFound('Candidate');
    }

    return candidate;
  }

  async internalIntake(
    dto: InternalCandidateIntakeDto,
    cvFile?: Express.Multer.File,
  ) {
    const opening = await this.scope.assertJobOpeningInScope(dto.jobOpeningId);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedMobile = dto.mobile?.replace(/\D/g, '') ?? null;

    if (cvFile?.buffer?.length) {
      this.documentService.validateUploadMetadata(
        cvFile.originalname,
        cvFile.mimetype,
        cvFile.buffer.length,
      );
      this.documentService.validateFileSignature(
        cvFile.buffer,
        cvFile.mimetype,
      );
    }

    let candidate = await this.prisma.candidate.findFirst({
      where: {
        companyGroupId: opening.companyGroupId,
        normalizedEmail,
      },
    });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          companyGroupId: opening.companyGroupId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim(),
          email: dto.email.trim(),
          normalizedEmail,
          mobile: dto.mobile?.trim(),
          normalizedMobile: normalizedMobile ?? undefined,
          source: dto.source ?? 'HR_INTERNAL',
        },
      });
    }

    const existingApplication = await this.prisma.jobApplication.findUnique({
      where: {
        candidateId_jobOpeningId: {
          candidateId: candidate.id,
          jobOpeningId: opening.id,
        },
      },
    });

    if (existingApplication) {
      throw new ConflictException(
        'Candidate already has an application for this opening',
      );
    }

    const applicationCode = await this.generateApplicationCode(
      opening.companyId,
    );

    const application = await this.prisma.jobApplication.create({
      data: {
        applicationCode,
        candidateId: candidate.id,
        jobOpeningId: opening.id,
        source: ApplicationSource.HR_INTERNAL,
        coverNote: dto.coverNote,
        submittedAt: new Date(),
        privacyAcknowledgedAt: new Date(),
      },
      include: {
        candidate: true,
        jobOpening: {
          select: {
            id: true,
            openingCode: true,
            title: true,
            status: true,
          },
        },
        documents: true,
      },
    });

    if (cvFile?.buffer?.length) {
      await this.documentService.storeUpload({
        buffer: cvFile.buffer,
        originalFileName: cvFile.originalname,
        declaredMimeType: cvFile.mimetype,
        kind: RecruitmentDocumentKind.CV,
        candidateId: candidate.id,
        jobApplicationId: application.id,
        uploadedByUserId: getRequestActor().userId,
      });

      const withDocuments = await this.prisma.jobApplication.findFirstOrThrow({
        where: { id: application.id },
        include: {
          candidate: true,
          jobOpening: {
            select: {
              id: true,
              openingCode: true,
              title: true,
              status: true,
            },
          },
          documents: true,
        },
      });

      return this.applicationTransitions.withAllowedActions(
        withDocuments,
        opening.companyId,
      );
    }

    return this.applicationTransitions.withAllowedActions(
      application,
      opening.companyId,
    );
  }

  private async generateApplicationCode(companyId: string) {
    const count = await this.prisma.jobApplication.count({
      where: {
        jobOpening: { companyId },
      },
    });

    return `APP-${(count + 1).toString().padStart(6, '0')}`;
  }
}
