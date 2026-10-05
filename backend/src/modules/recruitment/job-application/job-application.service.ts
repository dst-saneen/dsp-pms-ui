import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  getJobApplicationAllowedActions,
  JobApplicationTransitionService,
} from '../transitions';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { RecruitmentFeatureGateService } from '../services/recruitment-feature-gate.service';
import { RecruitmentShortlistGateService } from '../services/recruitment-shortlist-gate.service';

import { SearchJobApplicationDto } from './dto/search-job-application.dto';

const applicationInclude = {
  candidate: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      mobile: true,
    },
  },
  jobOpening: {
    select: {
      id: true,
      openingCode: true,
      title: true,
      status: true,
      branchId: true,
      companyId: true,
      hiringManagerEmployeeId: true,
      branch: {
        select: { id: true, branchName: true, branchCode: true },
      },
    },
  },
} satisfies Prisma.JobApplicationInclude;

@Injectable()
export class JobApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly featureGate: RecruitmentFeatureGateService,
    private readonly shortlistGate: RecruitmentShortlistGateService,
  ) {}

  async findAll(query: SearchJobApplicationDto) {
    const where: Prisma.JobApplicationWhereInput = {
      ...this.scope.jobApplicationWhere(),
    };

    if (query.jobOpeningId) {
      where.jobOpeningId = query.jobOpeningId;
    }
    if (query.candidateId) {
      where.candidateId = query.candidateId;
    }
    if (query.branchId) {
      where.jobOpening = {
        ...(where.jobOpening as Prisma.JobOpeningWhereInput),
        branchId: query.branchId,
      };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { applicationCode: { contains: query.search, mode: 'insensitive' } },
        {
          candidate: {
            firstName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          candidate: {
            lastName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          candidate: {
            email: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }
    if (query.submittedFrom || query.submittedTo) {
      where.submittedAt = {
        ...(query.submittedFrom
          ? { gte: new Date(query.submittedFrom) }
          : undefined),
        ...(query.submittedTo
          ? { lte: new Date(query.submittedTo) }
          : undefined),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where,
        include: applicationInclude,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    return {
      items: await Promise.all(
        items.map((item) => this.withAllowedActions(item)),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id,
        ...this.scope.jobApplicationWhere(),
      },
      include: {
        ...applicationInclude,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        interviews: {
          orderBy: { scheduledStartAt: 'asc' },
          include: {
            panelMembers: {
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                  },
                },
                evaluation: {
                  include: { scores: true },
                },
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      this.scope.notFound('Job application');
    }

    return this.withAllowedActions(application);
  }

  async getTimeline(id: string) {
    await this.scope.assertJobApplicationInScope(id);

    const history = await this.prisma.jobApplicationStatusHistory.findMany({
      where: { jobApplicationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return history;
  }

  shortlist(
    id: string,
    command: {
      expectedVersion: number;
      operationId: string;
      comment?: string;
    },
  ) {
    return this.applicationTransitions.shortlist(id, command);
  }

  startScreening(
    id: string,
    command: {
      expectedVersion: number;
      operationId: string;
    },
  ) {
    return this.applicationTransitions.startScreening(id, command);
  }

  advanceToInterview(
    id: string,
    command: {
      expectedVersion: number;
      operationId: string;
    },
  ) {
    return this.applicationTransitions.advanceToInterview(id, command);
  }

  reject(
    id: string,
    command: {
      expectedVersion: number;
      operationId: string;
      reasonCode?: string;
      comment?: string;
    },
  ) {
    return this.applicationTransitions.reject(id, command);
  }

  withdraw(
    id: string,
    command: {
      expectedVersion: number;
      operationId: string;
      reasonCode?: string;
      comment?: string;
    },
  ) {
    return this.applicationTransitions.withdraw(id, command);
  }

  advanceToManagerReview(
    id: string,
    command: {
      expectedVersion: number;
      operationId: string;
    },
  ) {
    return this.applicationTransitions.advanceToManagerReview(id, command);
  }

  private async withAllowedActions<
    T extends {
      status: Parameters<typeof getJobApplicationAllowedActions>[0];
      version: number;
      jobOpening: { companyId: string };
    },
  >(application: T) {
    if (
      !(await this.featureGate.isEnabledForCompany(
        application.jobOpening.companyId,
      ))
    ) {
      return {
        ...application,
        allowedActions: [],
      };
    }

    return {
      ...application,
      allowedActions: getJobApplicationAllowedActions(
        application.status,
        await this.shortlistGate.isEnabledForCompany(
          application.jobOpening.companyId,
        ),
      ),
    };
  }
}
