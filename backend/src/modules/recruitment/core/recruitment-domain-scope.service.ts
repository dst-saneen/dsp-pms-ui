import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { getOrganizationScope } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

type OrgScope = ReturnType<typeof getOrganizationScope>;

/**
 * Record-level tenant scope for recruitment-domain entities.
 */
@Injectable()
export class RecruitmentDomainScopeService {
  constructor(private readonly prisma: PrismaService) {}

  current(): OrgScope {
    return getOrganizationScope();
  }

  jobOpeningWhere(): Prisma.JobOpeningWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        companyGroupId: scope.activeCompanyGroupId,
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  jobApplicationWhere(): Prisma.JobApplicationWhereInput {
    return {
      jobOpening: this.jobOpeningWhere(),
    };
  }

  jobOfferWhere(): Prisma.JobOfferWhereInput {
    return {
      jobApplication: this.jobApplicationWhere(),
    };
  }

  candidateWhere(): Prisma.CandidateWhereInput {
    const openingScope = this.jobOpeningWhere();

    if (this.current().isGlobal) {
      return {};
    }

    return {
      applications: {
        some: {
          jobOpening: openingScope,
        },
      },
    };
  }

  notFound(entity = 'Record'): never {
    throw new NotFoundException(`${entity} not found`);
  }

  async assertJobOpeningInScope(jobOpeningId: string) {
    const opening = await this.prisma.jobOpening.findFirst({
      where: {
        id: jobOpeningId,
        ...this.jobOpeningWhere(),
      },
    });

    if (!opening) {
      this.notFound('Job opening');
    }

    return opening;
  }

  async assertJobApplicationInScope(jobApplicationId: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id: jobApplicationId,
        ...this.jobApplicationWhere(),
      },
      include: {
        jobOpening: true,
        candidate: true,
      },
    });

    if (!application) {
      this.notFound('Job application');
    }

    return application;
  }

  /**
   * Offer-signature actions are staff workflows. Scope them through the
   * offer's application and opening so a branch-scoped role cannot review an
   * offer from another branch in the same Company.
   */
  async assertJobOfferInScope(jobOfferId: string, expectedCompanyId?: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: {
        id: jobOfferId,
        ...this.jobOfferWhere(),
        ...(expectedCompanyId ? { companyId: expectedCompanyId } : {}),
      },
      select: { id: true, companyId: true, branchId: true },
    });

    if (!offer) {
      this.notFound('Job offer');
    }

    return offer;
  }

  async assertCandidateInScope(candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        ...this.candidateWhere(),
      },
    });

    if (!candidate) {
      this.notFound('Candidate');
    }

    return candidate;
  }
}
