import { Injectable } from '@nestjs/common';
import {
  EvaluationStatus,
  InterviewSessionStatus,
  JobApplicationStatus,
  JobOfferStatus,
  JobOpeningStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';

@Injectable()
export class RecruitmentDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
  ) {}

  async getSummary() {
    const openingWhere = this.scope.jobOpeningWhere();
    const applicationWhere = this.scope.jobApplicationWhere();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      openOpenings,
      draftOpenings,
      onHoldOpenings,
      newApplications,
      screeningApplications,
      interviewApplications,
      managerReviewApplications,
      interviewsToday,
      evaluationsPending,
      hiringDecisionsPending,
      offersAwaitingResponse,
      readyToHire,
      conversionBlockers,
    ] = await Promise.all([
      this.prisma.jobOpening.count({
        where: { ...openingWhere, status: JobOpeningStatus.OPEN },
      }),
      this.prisma.jobOpening.count({
        where: { ...openingWhere, status: JobOpeningStatus.DRAFT },
      }),
      this.prisma.jobOpening.count({
        where: { ...openingWhere, status: JobOpeningStatus.ON_HOLD },
      }),
      this.prisma.jobApplication.count({
        where: { ...applicationWhere, status: JobApplicationStatus.APPLIED },
      }),
      this.prisma.jobApplication.count({
        where: { ...applicationWhere, status: JobApplicationStatus.SCREENING },
      }),
      this.prisma.jobApplication.count({
        where: { ...applicationWhere, status: JobApplicationStatus.INTERVIEW },
      }),
      this.prisma.jobApplication.count({
        where: {
          ...applicationWhere,
          status: JobApplicationStatus.MANAGER_REVIEW,
        },
      }),
      this.prisma.interviewSession.count({
        where: {
          status: InterviewSessionStatus.SCHEDULED,
          scheduledStartAt: { gte: startOfDay, lte: endOfDay },
          jobApplication: applicationWhere,
        },
      }),
      this.prisma.interviewEvaluation.count({
        where: {
          status: EvaluationStatus.DRAFT,
          interviewSession: {
            status: InterviewSessionStatus.COMPLETED,
            jobApplication: applicationWhere,
          },
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          ...applicationWhere,
          status: JobApplicationStatus.MANAGER_REVIEW,
        },
      }),
      this.prisma.jobOffer.count({
        where: {
          status: JobOfferStatus.SENT,
          jobApplication: applicationWhere,
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          ...applicationWhere,
          status: JobApplicationStatus.OFFER_ACCEPTED,
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          ...applicationWhere,
          status: JobApplicationStatus.OFFER_ACCEPTED,
          employeeId: null,
        },
      }),
    ]);

    return {
      refreshedAt: now.toISOString(),
      kpis: {
        openOpenings,
        draftOpenings,
        onHoldOpenings,
        newApplications,
        screeningApplications,
        interviewApplications,
        managerReviewApplications,
        interviewsToday,
        evaluationsPending,
        hiringDecisionsPending,
        offersAwaitingResponse,
        readyToHire,
        conversionBlockers,
      },
      queues: {
        newApplications: await this.listApplications(
          JobApplicationStatus.APPLIED,
          10,
        ),
        screeningApplications: await this.listApplications(
          JobApplicationStatus.SCREENING,
          10,
        ),
        managerReviewApplications: await this.listApplications(
          JobApplicationStatus.MANAGER_REVIEW,
          10,
        ),
        readyToHire: await this.listApplications(
          JobApplicationStatus.OFFER_ACCEPTED,
          10,
        ),
      },
    };
  }

  private async listApplications(status: JobApplicationStatus, limit: number) {
    return this.prisma.jobApplication.findMany({
      where: {
        ...this.scope.jobApplicationWhere(),
        status,
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        applicationCode: true,
        status: true,
        submittedAt: true,
        candidate: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        jobOpening: {
          select: { id: true, openingCode: true, title: true },
        },
      },
    });
  }
}
