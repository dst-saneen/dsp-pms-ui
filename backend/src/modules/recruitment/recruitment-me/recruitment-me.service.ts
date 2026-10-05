import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationStatus, JobApplicationStatus, Prisma } from '@prisma/client';

import { DomainConflictException, WorkforceErrorCode } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { RecruitmentFeatureGateService } from '../services/recruitment-feature-gate.service';
import { RecruitmentShortlistGateService } from '../services/recruitment-shortlist-gate.service';
import { JobApplicationTransitionService } from '../transitions';
import { getJobApplicationAllowedActions } from '../transitions/recruitment-transition.types';

import {
  SaveEvaluationDraftDto,
  SubmitEvaluationDto,
} from './dto/evaluation.dto';
import { HiringDecisionDto } from './dto/hiring-decision.dto';

@Injectable()
export class RecruitmentMeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly featureGate: RecruitmentFeatureGateService,
    private readonly shortlistGate: RecruitmentShortlistGateService,
  ) {}

  async getPanelInterviews(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);

    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        panelMembers: {
          some: { employeeId },
        },
        jobApplication: this.scope.jobApplicationWhere(),
      },
      orderBy: { scheduledStartAt: 'asc' },
      include: {
        jobApplication: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            jobOpening: {
              select: {
                id: true,
                openingCode: true,
                title: true,
              },
            },
          },
        },
        panelMembers: {
          where: { employeeId },
          include: {
            evaluation: true,
          },
        },
      },
    });

    return sessions.map((session) => ({
      ...session,
      myEvaluation: session.panelMembers[0]?.evaluation ?? null,
    }));
  }

  async getEvaluation(user: AuthenticatedUser, interviewSessionId: string) {
    const employeeId = this.requireEmployeeId(user);
    const panelMember = await this.assertPanelMember(
      interviewSessionId,
      employeeId,
    );

    const evaluation = await this.prisma.interviewEvaluation.findUnique({
      where: { panelMemberId: panelMember.id },
      include: {
        scores: {
          include: {
            criterion: true,
          },
        },
        interviewSession: {
          include: {
            jobApplication: {
              include: {
                candidate: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                jobOpening: {
                  include: {
                    criteria: {
                      where: { isActive: true },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return evaluation;
  }

  async saveEvaluationDraft(
    user: AuthenticatedUser,
    interviewSessionId: string,
    dto: SaveEvaluationDraftDto,
  ) {
    const employeeId = this.requireEmployeeId(user);
    const panelMember = await this.assertPanelMember(
      interviewSessionId,
      employeeId,
    );

    const evaluation = await this.ensureDraftEvaluation(
      panelMember,
      interviewSessionId,
      employeeId,
      dto.version,
    );

    const weightedTotal = dto.scores
      ? await this.calculateWeightedTotal(interviewSessionId, dto.scores)
      : evaluation.weightedTotal;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.scores) {
        await tx.interviewEvaluationScore.deleteMany({
          where: { evaluationId: evaluation.id },
        });
      }

      return tx.interviewEvaluation.update({
        where: { id: evaluation.id, version: evaluation.version },
        data: {
          recommendation: dto.recommendation,
          strengths: dto.strengths,
          concerns: dto.concerns,
          confidentialNotes: dto.confidentialNotes,
          weightedTotal: weightedTotal ?? undefined,
          version: { increment: 1 },
          scores: dto.scores
            ? {
                create: await this.buildScoreCreates(
                  tx,
                  interviewSessionId,
                  dto.scores,
                ),
              }
            : undefined,
        },
        include: { scores: true },
      });
    });

    return updated;
  }

  async submitEvaluation(
    user: AuthenticatedUser,
    interviewSessionId: string,
    dto: SubmitEvaluationDto,
  ) {
    const employeeId = this.requireEmployeeId(user);
    const panelMember = await this.assertPanelMember(
      interviewSessionId,
      employeeId,
    );

    const evaluation = await this.ensureDraftEvaluation(
      panelMember,
      interviewSessionId,
      employeeId,
      dto.version,
    );

    const weightedTotal = await this.calculateWeightedTotal(
      interviewSessionId,
      dto.scores,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.interviewEvaluationScore.deleteMany({
        where: { evaluationId: evaluation.id },
      });

      return tx.interviewEvaluation.update({
        where: { id: evaluation.id, version: evaluation.version },
        data: {
          status: EvaluationStatus.SUBMITTED,
          recommendation: dto.recommendation,
          strengths: dto.strengths,
          concerns: dto.concerns,
          confidentialNotes: dto.confidentialNotes,
          weightedTotal,
          submittedAt: new Date(),
          version: { increment: 1 },
          scores: {
            create: await this.buildScoreCreates(
              tx,
              interviewSessionId,
              dto.scores,
            ),
          },
        },
        include: { scores: true },
      });
    });

    return updated;
  }

  async getHiringDecisions(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);

    const applications = await this.prisma.jobApplication.findMany({
      where: {
        status: JobApplicationStatus.MANAGER_REVIEW,
        jobOpening: {
          ...this.scope.jobOpeningWhere(),
          hiringManagerEmployeeId: employeeId,
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        jobOpening: {
          select: {
            id: true,
            companyId: true,
            openingCode: true,
            title: true,
            headcountTotal: true,
            headcountFilled: true,
            headcountReserved: true,
            branch: { select: { branchName: true } },
          },
        },
        interviews: {
          include: {
            evaluations: {
              where: { status: EvaluationStatus.SUBMITTED },
              select: {
                id: true,
                weightedTotal: true,
                recommendation: true,
                strengths: true,
                concerns: true,
              },
            },
          },
        },
      },
    });

    const shortlistByCompany = new Map<string, Promise<boolean>>();
    const recruitmentByCompany = new Map<string, Promise<boolean>>();
    const isRecruitmentEnabled = (companyId: string) => {
      let enabled = recruitmentByCompany.get(companyId);
      if (!enabled) {
        enabled = this.featureGate.isEnabledForCompany(companyId);
        recruitmentByCompany.set(companyId, enabled);
      }
      return enabled;
    };
    const isShortlistEnabled = (companyId: string) => {
      let enabled = shortlistByCompany.get(companyId);
      if (!enabled) {
        enabled = this.shortlistGate.isEnabledForCompany(companyId);
        shortlistByCompany.set(companyId, enabled);
      }
      return enabled;
    };

    return Promise.all(
      applications.map(async (application) => {
        const { companyId, ...jobOpening } = application.jobOpening;

        const recruitmentEnabled = await isRecruitmentEnabled(companyId);

        return {
          record: {
            ...application,
            jobOpening,
          },
          version: application.version,
          allowedActions: recruitmentEnabled
            ? getJobApplicationAllowedActions(
                application.status,
                await isShortlistEnabled(companyId),
              )
            : [],
        };
      }),
    );
  }

  async selectCandidate(
    user: AuthenticatedUser,
    jobApplicationId: string,
    dto: HiringDecisionDto,
  ) {
    await this.assertHiringManager(user, jobApplicationId);
    return this.applicationTransitions.select(jobApplicationId, dto.version);
  }

  async rejectCandidate(
    user: AuthenticatedUser,
    jobApplicationId: string,
    dto: HiringDecisionDto,
  ) {
    await this.assertHiringManager(user, jobApplicationId);
    return this.applicationTransitions.reject(jobApplicationId, {
      expectedVersion: dto.version ?? 1,
      operationId: crypto.randomUUID(),
      reasonCode: dto.reasonCode,
      comment: dto.comment,
    });
  }

  async getCandidateComparison(user: AuthenticatedUser, openingId: string) {
    const employeeId = this.requireEmployeeId(user);

    const opening = await this.prisma.jobOpening.findFirst({
      where: {
        id: openingId,
        hiringManagerEmployeeId: employeeId,
        ...this.scope.jobOpeningWhere(),
      },
      select: {
        id: true,
        companyId: true,
        openingCode: true,
        title: true,
        headcountTotal: true,
        headcountFilled: true,
        headcountReserved: true,
        branch: { select: { branchName: true } },
      },
    });

    if (!opening) {
      throw new NotFoundException('Opening not found');
    }

    const [recruitmentEnabled, shortlistEnabled] = await Promise.all([
      this.featureGate.isEnabledForCompany(opening.companyId),
      this.shortlistGate.isEnabledForCompany(opening.companyId),
    ]);
    const openingSummary = {
      id: opening.id,
      openingCode: opening.openingCode,
      title: opening.title,
      headcountTotal: opening.headcountTotal,
      headcountFilled: opening.headcountFilled,
      headcountReserved: opening.headcountReserved,
      branch: opening.branch,
    };

    const applications = await this.prisma.jobApplication.findMany({
      where: {
        jobOpeningId: openingId,
        status: JobApplicationStatus.MANAGER_REVIEW,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        interviews: {
          orderBy: { roundNumber: 'asc' },
          select: {
            roundNumber: true,
            roundName: true,
            status: true,
            isRequired: true,
            evaluations: {
              where: { status: EvaluationStatus.SUBMITTED },
              select: {
                weightedTotal: true,
                recommendation: true,
                strengths: true,
                concerns: true,
              },
            },
          },
        },
      },
    });

    return {
      opening: openingSummary,
      candidates: applications.map((application) => ({
        applicationId: application.id,
        applicationCode: application.applicationCode,
        candidateId: application.candidateId,
        status: application.status,
        submittedAt: application.submittedAt,
        version: application.version,
        allowedActions: recruitmentEnabled
          ? getJobApplicationAllowedActions(
              application.status,
              shortlistEnabled,
            )
          : [],
        candidate: application.candidate,
        interviews: application.interviews,
      })),
    };
  }

  private requireEmployeeId(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException({
        code: WorkforceErrorCode.EMPLOYEE_LINK_REQUIRED,
        message: 'An employee profile is required for this action',
      });
    }

    return user.employeeId;
  }

  private async assertPanelMember(
    interviewSessionId: string,
    employeeId: string,
  ) {
    const panelMember = await this.prisma.interviewPanelMember.findFirst({
      where: {
        interviewSessionId,
        employeeId,
        interviewSession: {
          jobApplication: this.scope.jobApplicationWhere(),
        },
      },
    });

    if (!panelMember) {
      throw new NotFoundException('Interview assignment not found');
    }

    return panelMember;
  }

  private async ensureDraftEvaluation(
    panelMember: { id: string },
    interviewSessionId: string,
    employeeId: string,
    expectedVersion?: number,
  ) {
    let evaluation = await this.prisma.interviewEvaluation.findUnique({
      where: { panelMemberId: panelMember.id },
    });

    if (!evaluation) {
      evaluation = await this.prisma.interviewEvaluation.create({
        data: {
          interviewSessionId,
          panelMemberId: panelMember.id,
          employeeId,
        },
      });
    }

    if (evaluation.status === EvaluationStatus.SUBMITTED) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.EVALUATION_IMMUTABLE,
        'Submitted evaluations cannot be modified',
      );
    }

    if (
      expectedVersion !== undefined &&
      evaluation.version !== expectedVersion
    ) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_STALE_VERSION,
        'Evaluation was modified by another request',
      );
    }

    return evaluation;
  }

  private async calculateWeightedTotal(
    interviewSessionId: string,
    scores: Array<{ criterionId: string; score: number }>,
  ) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: interviewSessionId },
      include: {
        jobApplication: {
          include: {
            jobOpening: {
              include: {
                criteria: { where: { isActive: true } },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Interview session not found');
    }

    const criteriaById = new Map(
      session.jobApplication.jobOpening.criteria.map((criterion) => [
        criterion.id,
        criterion,
      ]),
    );

    let total = 0;

    for (const item of scores) {
      const criterion = criteriaById.get(item.criterionId);

      if (!criterion) {
        throw new NotFoundException('Criterion not found');
      }

      const contribution = (item.score / 5) * Number(criterion.weightPercent);
      total += contribution;
    }

    return Number(total.toFixed(2));
  }

  private async buildScoreCreates(
    tx: Prisma.TransactionClient,
    interviewSessionId: string,
    scores: Array<{ criterionId: string; score: number }>,
  ) {
    const session = await tx.interviewSession.findUnique({
      where: { id: interviewSessionId },
      include: {
        jobApplication: {
          include: {
            jobOpening: {
              include: { criteria: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Interview session not found');
    }

    const criteriaById = new Map(
      session.jobApplication.jobOpening.criteria.map((criterion) => [
        criterion.id,
        criterion,
      ]),
    );

    return scores.map((item) => {
      const criterion = criteriaById.get(item.criterionId);

      if (!criterion) {
        throw new NotFoundException('Criterion not found');
      }

      const weightedContribution =
        (item.score / 5) * Number(criterion.weightPercent);

      return {
        criterionId: criterion.id,
        criterionNameSnapshot: criterion.name,
        weightPercentSnapshot: criterion.weightPercent,
        score: item.score,
        weightedContribution,
      };
    });
  }

  private async assertHiringManager(
    user: AuthenticatedUser,
    jobApplicationId: string,
  ) {
    const employeeId = this.requireEmployeeId(user);
    const application =
      await this.scope.assertJobApplicationInScope(jobApplicationId);

    if (application.jobOpening.hiringManagerEmployeeId !== employeeId) {
      throw new ForbiddenException({
        code: RECRUITMENT_ERROR_CODES.NOT_HIRING_MANAGER,
        message: 'Only the hiring manager for this opening may decide',
      });
    }

    if (application.status !== JobApplicationStatus.MANAGER_REVIEW) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.REQUIRED_ROUNDS_INCOMPLETE,
        'Application is not awaiting hiring manager decision',
      );
    }

    return application;
  }
}
