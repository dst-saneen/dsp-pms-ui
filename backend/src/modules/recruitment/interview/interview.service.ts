import { Injectable } from '@nestjs/common';
import {
  EvaluationStatus,
  InterviewSessionStatus,
  JobApplicationStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { JobApplicationTransitionService } from '../transitions';
import { RecruitmentOutboxService } from '../services/recruitment-outbox.service';

import { SearchInterviewDto } from './dto/search-interview.dto';
import {
  CancelInterviewDto,
  RescheduleInterviewDto,
  ScheduleInterviewDto,
} from './dto/schedule-interview.dto';

const interviewListInclude = {
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
      evaluation: { include: { scores: true } },
    },
  },
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
          branchId: true,
          branch: { select: { branchName: true } },
        },
      },
    },
  },
} satisfies Prisma.InterviewSessionInclude;

@Injectable()
export class InterviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly auditService: AuditService,
    private readonly applicationTransitions: JobApplicationTransitionService,
    private readonly outbox: RecruitmentOutboxService,
  ) {}

  async listAll(query: SearchInterviewDto) {
    const where: Prisma.InterviewSessionWhereInput = {
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
    if (query.scheduledFrom || query.scheduledTo) {
      where.scheduledStartAt = {
        ...(query.scheduledFrom ? { gte: new Date(query.scheduledFrom) } : {}),
        ...(query.scheduledTo ? { lte: new Date(query.scheduledTo) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { roundName: { contains: query.search, mode: 'insensitive' } },
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
      this.prisma.interviewSession.findMany({
        where,
        include: interviewListInclude,
        orderBy: { scheduledStartAt: query.sortOrder ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.interviewSession.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async listForApplication(applicationId: string) {
    await this.scope.assertJobApplicationInScope(applicationId);

    return this.prisma.interviewSession.findMany({
      where: { jobApplicationId: applicationId },
      orderBy: [{ roundNumber: 'asc' }, { scheduledStartAt: 'asc' }],
      include: interviewListInclude,
    });
  }

  async schedule(applicationId: string, dto: ScheduleInterviewDto) {
    let application =
      await this.scope.assertJobApplicationInScope(applicationId);

    if (application.status === JobApplicationStatus.SCREENING) {
      if (dto.applicationVersion === undefined) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.APPLICATION_STALE_VERSION,
          'Application version is required when scheduling from screening.',
        );
      }

      await this.applicationTransitions.advanceToInterview(applicationId, {
        expectedVersion: dto.applicationVersion,
        operationId: randomUUID(),
      });
      application = await this.scope.assertJobApplicationInScope(applicationId);
    } else if (application.status !== JobApplicationStatus.INTERVIEW) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        'Interviews can only be scheduled while application is in screening or interview.',
      );
    }

    if (dto.panelMembers.length === 0) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.PANEL_NOT_ASSIGNED,
        'At least one panel member is required.',
      );
    }

    const actor = getRequestActor();
    const panelUserIds = await this.resolvePanelUserIds(
      dto.panelMembers.map((member) => member.employeeId),
    );

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interviewSession.create({
        data: {
          jobApplicationId: applicationId,
          roundNumber: dto.roundNumber,
          roundName: dto.roundName.trim(),
          isRequired: dto.isRequired ?? true,
          scheduledStartAt: new Date(dto.scheduledStartAt),
          scheduledEndAt: new Date(dto.scheduledEndAt),
          timezone: dto.timezone.trim(),
          mode: dto.mode,
          locationOrLink: dto.locationOrLink?.trim(),
          evaluationDeadlineAt: dto.evaluationDeadlineAt
            ? new Date(dto.evaluationDeadlineAt)
            : undefined,
          status: InterviewSessionStatus.SCHEDULED,
          panelMembers: {
            create: dto.panelMembers.map((member) => ({
              employeeId: member.employeeId,
              isLead: member.isLead ?? false,
            })),
          },
        },
        include: {
          panelMembers: true,
        },
      });

      for (const member of created.panelMembers) {
        await tx.interviewEvaluation.create({
          data: {
            interviewSessionId: created.id,
            panelMemberId: member.id,
            employeeId: member.employeeId,
          },
        });
      }

      await this.auditService.log(
        'InterviewSession',
        created.id,
        'SCHEDULE',
        null,
        { jobApplicationId: applicationId, roundNumber: dto.roundNumber },
        { tx, userId: actor.userId },
      );

      await this.outbox.enqueue(
        tx,
        'recruitment.interview.scheduled',
        created.id,
        {
          companyGroupId: application.jobOpening.companyGroupId,
          companyId: application.jobOpening.companyId,
          branchId: application.jobOpening.branchId,
          jobApplicationId: applicationId,
          jobOpeningId: application.jobOpeningId,
          candidateId: application.candidateId,
          interviewSessionId: created.id,
          recipientUserIds: panelUserIds,
        },
        `recruitment:interview-scheduled:${created.id}`,
      );

      return created;
    });

    return this.findSession(applicationId, session.id);
  }

  async reschedule(
    applicationId: string,
    sessionId: string,
    dto: RescheduleInterviewDto,
  ) {
    const application =
      await this.scope.assertJobApplicationInScope(applicationId);
    const session = await this.findSessionOrThrow(applicationId, sessionId);

    if (session.status === InterviewSessionStatus.COMPLETED) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        'Completed interviews cannot be rescheduled.',
      );
    }

    const actor = getRequestActor();
    const panelUserIds = await this.resolvePanelUserIdsForSession(sessionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          scheduledStartAt: new Date(dto.scheduledStartAt),
          scheduledEndAt: new Date(dto.scheduledEndAt),
          timezone: dto.timezone.trim(),
          locationOrLink: dto.locationOrLink?.trim(),
          evaluationDeadlineAt: dto.evaluationDeadlineAt
            ? new Date(dto.evaluationDeadlineAt)
            : undefined,
          status: InterviewSessionStatus.RESCHEDULED,
          rescheduleReason: dto.reason.trim(),
        },
      });

      await this.auditService.log(
        'InterviewSession',
        sessionId,
        'RESCHEDULE',
        { status: session.status },
        { status: InterviewSessionStatus.RESCHEDULED },
        { tx, userId: actor.userId },
      );

      await this.outbox.enqueue(
        tx,
        'recruitment.interview.rescheduled',
        sessionId,
        {
          companyGroupId: application.jobOpening.companyGroupId,
          companyId: application.jobOpening.companyId,
          branchId: application.jobOpening.branchId,
          jobApplicationId: applicationId,
          jobOpeningId: application.jobOpeningId,
          candidateId: application.candidateId,
          interviewSessionId: sessionId,
          recipientUserIds: panelUserIds,
        },
        `recruitment:interview-rescheduled:${sessionId}:${Date.now()}`,
      );
    });

    return this.findSession(applicationId, sessionId);
  }

  async cancel(
    applicationId: string,
    sessionId: string,
    dto: CancelInterviewDto,
  ) {
    const application =
      await this.scope.assertJobApplicationInScope(applicationId);
    const session = await this.findSessionOrThrow(applicationId, sessionId);

    if (session.status === InterviewSessionStatus.COMPLETED) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        'Completed interviews cannot be cancelled.',
      );
    }

    const actor = getRequestActor();
    const panelUserIds = await this.resolvePanelUserIdsForSession(sessionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: InterviewSessionStatus.CANCELLED,
          cancellationReason: dto.reason.trim(),
        },
      });

      await this.auditService.log(
        'InterviewSession',
        sessionId,
        'CANCEL',
        { status: session.status },
        { status: InterviewSessionStatus.CANCELLED },
        { tx, userId: actor.userId },
      );

      await this.outbox.enqueue(
        tx,
        'recruitment.interview.cancelled',
        sessionId,
        {
          companyGroupId: application.jobOpening.companyGroupId,
          companyId: application.jobOpening.companyId,
          branchId: application.jobOpening.branchId,
          jobApplicationId: applicationId,
          jobOpeningId: application.jobOpeningId,
          candidateId: application.candidateId,
          interviewSessionId: sessionId,
          recipientUserIds: panelUserIds,
        },
        `recruitment:interview-cancelled:${sessionId}`,
      );
    });

    return this.findSession(applicationId, sessionId);
  }

  async complete(applicationId: string, sessionId: string) {
    await this.scope.assertJobApplicationInScope(applicationId);
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: sessionId, jobApplicationId: applicationId },
      include: {
        panelMembers: {
          include: {
            evaluation: true,
          },
        },
      },
    });

    if (!session) {
      throw new DomainNotFoundException(
        'INTERVIEW_NOT_FOUND',
        'Interview session not found.',
      );
    }

    if (session.status === InterviewSessionStatus.CANCELLED) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        'Cancelled interviews cannot be completed.',
      );
    }

    if (
      session.panelMembers.length === 0 ||
      session.panelMembers.some(
        (member) =>
          !member.evaluation ||
          member.evaluation.status !== EvaluationStatus.SUBMITTED,
      )
    ) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.REQUIRED_ROUNDS_INCOMPLETE,
        'All panel evaluations must be submitted before completing the interview.',
      );
    }

    const actor = getRequestActor();

    await this.prisma.$transaction(async (tx) => {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: { status: InterviewSessionStatus.COMPLETED },
      });

      await this.auditService.log(
        'InterviewSession',
        sessionId,
        'COMPLETE',
        { status: session.status },
        { status: InterviewSessionStatus.COMPLETED },
        { tx, userId: actor.userId },
      );
    });

    return this.findSession(applicationId, sessionId);
  }

  private async findSessionOrThrow(applicationId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: sessionId, jobApplicationId: applicationId },
    });

    if (!session) {
      throw new DomainNotFoundException(
        'INTERVIEW_NOT_FOUND',
        'Interview session not found.',
      );
    }

    return session;
  }

  private async findSession(applicationId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: sessionId, jobApplicationId: applicationId },
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
            evaluation: { include: { scores: true } },
          },
        },
      },
    });

    if (!session) {
      throw new DomainNotFoundException(
        'INTERVIEW_NOT_FOUND',
        'Interview session not found.',
      );
    }

    return session;
  }

  private async resolvePanelUserIds(employeeIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private async resolvePanelUserIdsForSession(
    sessionId: string,
  ): Promise<string[]> {
    const members = await this.prisma.interviewPanelMember.findMany({
      where: { interviewSessionId: sessionId },
      select: { employeeId: true },
    });

    return this.resolvePanelUserIds(members.map((member) => member.employeeId));
  }
}
