import { Injectable } from '@nestjs/common';
import {
  EvaluationStatus,
  InterviewSessionStatus,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';

@Injectable()
export class InterviewPrerequisitesService {
  constructor(private readonly prisma: PrismaService) {}

  async assertRequiredInterviewsComplete(
    jobApplicationId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const requiredSessions = await client.interviewSession.findMany({
      where: { jobApplicationId, isRequired: true },
      include: {
        panelMembers: {
          include: { evaluation: true },
        },
      },
      orderBy: [{ roundNumber: 'asc' }, { scheduledStartAt: 'asc' }],
    });
    const activeRequiredSessions = requiredSessions.filter(
      (session) => session.status !== InterviewSessionStatus.CANCELLED,
    );

    if (activeRequiredSessions.length === 0) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.REQUIRED_ROUNDS_INCOMPLETE,
        'At least one required interview round must be scheduled and completed.',
      );
    }

    for (const session of activeRequiredSessions) {
      if (session.status !== InterviewSessionStatus.COMPLETED) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.REQUIRED_ROUNDS_INCOMPLETE,
          `Required interview round "${session.roundName}" is not completed.`,
        );
      }

      if (session.panelMembers.length === 0) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.REQUIRED_ROUNDS_INCOMPLETE,
          `Required interview round "${session.roundName}" has no panel members.`,
        );
      }

      for (const member of session.panelMembers) {
        if (
          !member.evaluation ||
          member.evaluation.status !== EvaluationStatus.SUBMITTED
        ) {
          throw new DomainConflictException(
            RECRUITMENT_ERROR_CODES.REQUIRED_ROUNDS_INCOMPLETE,
            `Required evaluations are missing for round "${session.roundName}".`,
          );
        }
      }
    }
  }
}
