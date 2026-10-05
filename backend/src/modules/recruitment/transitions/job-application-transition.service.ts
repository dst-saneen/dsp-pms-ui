import { Injectable } from '@nestjs/common';
import {
  JobApplication,
  JobApplicationStatus,
  Prisma,
  RecruitmentActorType,
} from '@prisma/client';

import {
  DomainConflictException,
  getRequestActor,
  getRequestId,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { isAllowedApplicationTransition } from '../core/recruitment.utils';
import { InterviewPrerequisitesService } from '../interview/interview-prerequisites.service';
import { RecruitmentCommandReceiptService } from '../services/recruitment-command-receipt.service';
import { RecruitmentFeatureGateService } from '../services/recruitment-feature-gate.service';
import { RecruitmentShortlistGateService } from '../services/recruitment-shortlist-gate.service';

import {
  getJobApplicationAllowedActions,
  JobApplicationTransitionResult,
} from './recruitment-transition.types';

const TERMINAL_APPLICATION_STATUSES: JobApplicationStatus[] = [
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
  'OFFER_DECLINED',
];

export interface ApplicationCommandInput {
  expectedVersion: number;
  operationId: string;
  reasonCode?: string;
  comment?: string;
}

@Injectable()
export class JobApplicationTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly featureGate: RecruitmentFeatureGateService,
    private readonly auditService: AuditService,
    private readonly interviewPrerequisites: InterviewPrerequisitesService,
    private readonly receipts: RecruitmentCommandReceiptService,
    private readonly shortlistGate: RecruitmentShortlistGateService,
  ) {}

  private async allowedActionsFor(
    status: JobApplicationStatus,
    companyId: string | null | undefined,
  ) {
    if (!(await this.featureGate.isEnabledForCompany(companyId))) {
      return [];
    }

    return getJobApplicationAllowedActions(
      status,
      await this.shortlistGate.isEnabledForCompany(companyId),
    );
  }

  async shortlist(
    jobApplicationId: string,
    command: ApplicationCommandInput,
  ): Promise<JobApplicationTransitionResult> {
    return this.commandedTransition(
      jobApplicationId,
      'SHORTLISTED',
      'shortlist',
      command,
      {
        comment: command.comment,
        shortlistedAt: new Date(),
      },
    );
  }

  async startScreening(
    jobApplicationId: string,
    command: ApplicationCommandInput,
  ): Promise<JobApplicationTransitionResult> {
    return this.commandedTransition(
      jobApplicationId,
      'SCREENING',
      'start_screening',
      command,
      { screeningStartedAt: new Date() },
    );
  }

  async advanceToInterview(
    jobApplicationId: string,
    command: ApplicationCommandInput,
  ): Promise<JobApplicationTransitionResult> {
    return this.commandedTransition(
      jobApplicationId,
      'INTERVIEW',
      'advance_to_interview',
      command,
    );
  }

  async reject(
    jobApplicationId: string,
    command: ApplicationCommandInput,
  ): Promise<JobApplicationTransitionResult> {
    return this.commandedTransition(
      jobApplicationId,
      'REJECTED',
      'reject',
      command,
      {
        reasonCode: command.reasonCode,
        comment: command.comment,
      },
    );
  }

  async withdraw(
    jobApplicationId: string,
    command: ApplicationCommandInput,
  ): Promise<JobApplicationTransitionResult> {
    return this.commandedTransition(
      jobApplicationId,
      'WITHDRAWN',
      'withdraw',
      command,
      {
        reasonCode: command.reasonCode,
        comment: command.comment,
      },
    );
  }

  async select(
    jobApplicationId: string,
    expectedVersion?: number,
  ): Promise<JobApplicationTransitionResult> {
    return this.transition(jobApplicationId, 'SELECTED', expectedVersion, {
      selectedAt: new Date(),
    });
  }

  async advanceToManagerReview(
    jobApplicationId: string,
    command: ApplicationCommandInput,
  ): Promise<JobApplicationTransitionResult> {
    await this.interviewPrerequisites.assertRequiredInterviewsComplete(
      jobApplicationId,
    );

    return this.commandedTransition(
      jobApplicationId,
      'MANAGER_REVIEW',
      'advance_to_manager_review',
      command,
    );
  }

  async revertToSelectedAfterOfferRevoked(
    jobApplicationId: string,
    expectedVersion?: number,
    tx?: Prisma.TransactionClient,
    meta?: { reasonCode?: string; actorId?: string },
  ): Promise<JobApplicationTransitionResult> {
    const application =
      await this.scope.assertJobApplicationInScope(jobApplicationId);
    await this.featureGate.assertEnabledForCompany(
      application.jobOpening.companyId,
    );

    if (application.status !== JobApplicationStatus.OFFER_SENT) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        'Only sent offers can be reverted to selected.',
      );
    }

    if (
      expectedVersion !== undefined &&
      application.version !== expectedVersion
    ) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_STATE_CHANGED,
        'Job application was modified by another request',
      );
    }

    const actor = getRequestActor();
    const actorId = meta?.actorId ?? actor.userId;
    const fromStatus = application.status;

    const run = async (client: Prisma.TransactionClient) => {
      const row = await client.jobApplication.update({
        where: {
          id: application.id,
          version: application.version,
        },
        data: {
          status: JobApplicationStatus.SELECTED,
          version: { increment: 1 },
        },
      });

      await client.jobApplicationStatusHistory.create({
        data: {
          jobApplicationId: application.id,
          fromStatus,
          toStatus: JobApplicationStatus.SELECTED,
          reasonCode: meta?.reasonCode ?? 'OFFER_REVOKED',
          actorType: RecruitmentActorType.USER,
          actorId,
          requestId: getRequestId(),
        },
      });

      await this.auditService.log(
        'JobApplication',
        application.id,
        'STATUS_SELECTED',
        { status: fromStatus, version: application.version },
        { status: row.status, version: row.version },
        { tx: client, userId: actorId },
      );

      return row;
    };

    const updated = tx ? await run(tx) : await this.prisma.$transaction(run);

    return {
      record: updated,
      version: updated.version,
      allowedActions: await this.allowedActionsFor(
        updated.status,
        application.jobOpening.companyId,
      ),
    };
  }

  async markOfferSent(
    jobApplicationId: string,
    expectedVersion?: number,
  ): Promise<JobApplicationTransitionResult> {
    return this.transition(jobApplicationId, 'OFFER_SENT', expectedVersion, {
      offerSentAt: new Date(),
    });
  }

  async markOfferAccepted(
    jobApplicationId: string,
    expectedVersion?: number,
    actorType: RecruitmentActorType = RecruitmentActorType.CANDIDATE,
  ): Promise<JobApplicationTransitionResult> {
    return this.transition(
      jobApplicationId,
      'OFFER_ACCEPTED',
      expectedVersion,
      {
        offerAcceptedAt: new Date(),
        actorType,
      },
    );
  }

  async markHired(
    jobApplicationId: string,
    expectedVersion?: number,
  ): Promise<JobApplicationTransitionResult> {
    return this.transition(jobApplicationId, 'HIRED', expectedVersion, {
      hiredAt: new Date(),
    });
  }

  async declineOffer(
    jobApplicationId: string,
    reasonCode?: string,
    comment?: string,
    expectedVersion?: number,
  ): Promise<JobApplicationTransitionResult> {
    return this.transition(
      jobApplicationId,
      'OFFER_DECLINED',
      expectedVersion,
      {
        reasonCode,
        comment,
        actorType: RecruitmentActorType.CANDIDATE,
      },
    );
  }

  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    application: JobApplication,
    targetStatus: JobApplicationStatus,
    meta?: {
      reasonCode?: string;
      comment?: string;
      shortlistedAt?: Date;
      screeningStartedAt?: Date;
      selectedAt?: Date;
      offerSentAt?: Date;
      offerAcceptedAt?: Date;
      hiredAt?: Date;
      actorType?: RecruitmentActorType;
      actorId?: string;
    },
  ): Promise<JobApplication> {
    const opening = await tx.jobOpening.findUnique({
      where: { id: application.jobOpeningId },
      select: { companyId: true },
    });
    await this.featureGate.assertEnabledForCompany(opening?.companyId);
    const shortlistEnabled = await this.shortlistGate.isEnabledForCompany(
      opening?.companyId,
    );

    if (TERMINAL_APPLICATION_STATUSES.includes(application.status)) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        `Job application in ${application.status} cannot be transitioned`,
      );
    }

    if (targetStatus === 'SHORTLISTED') {
      if (!shortlistEnabled) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.RECRUITMENT_SHORTLIST_MODULE_NOT_ENABLED,
          'Shortlisting is not enabled for this Company.',
        );
      }
    }

    if (
      !isAllowedApplicationTransition(
        application.status,
        targetStatus,
        shortlistEnabled,
      )
    ) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_INVALID_TRANSITION,
        `Cannot transition job application from ${application.status} to ${targetStatus}`,
      );
    }

    const actor = getRequestActor();
    const fromStatus = application.status;
    const actorType = meta?.actorType ?? RecruitmentActorType.USER;
    const actorId = meta?.actorId ?? actor.userId;

    let row: JobApplication;
    try {
      row = await tx.jobApplication.update({
        where: {
          id: application.id,
          version: application.version,
        },
        data: {
          status: targetStatus,
          version: { increment: 1 },
          shortlistedAt: meta?.shortlistedAt,
          screeningStartedAt: meta?.screeningStartedAt,
          selectedAt: meta?.selectedAt,
          offerSentAt: meta?.offerSentAt,
          offerAcceptedAt: meta?.offerAcceptedAt,
          hiredAt: meta?.hiredAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.APPLICATION_STATE_CHANGED,
          'Job application was modified by another request',
        );
      }
      throw error;
    }

    await tx.jobApplicationStatusHistory.create({
      data: {
        jobApplicationId: application.id,
        fromStatus,
        toStatus: targetStatus,
        reasonCode: meta?.reasonCode,
        comment: meta?.comment,
        actorType,
        actorId,
        requestId: getRequestId(),
      },
    });

    await this.auditService.log(
      'JobApplication',
      application.id,
      `STATUS_${targetStatus}`,
      { status: fromStatus, version: application.version },
      { status: row.status, version: row.version },
      { tx, userId: actorId },
    );

    return row;
  }

  private async commandedTransition(
    jobApplicationId: string,
    targetStatus: JobApplicationStatus,
    commandType: string,
    command: ApplicationCommandInput,
    meta?: {
      reasonCode?: string;
      comment?: string;
      shortlistedAt?: Date;
      screeningStartedAt?: Date;
      selectedAt?: Date;
      offerSentAt?: Date;
      offerAcceptedAt?: Date;
      hiredAt?: Date;
      actorType?: RecruitmentActorType;
      actorId?: string;
    },
  ): Promise<JobApplicationTransitionResult> {
    const application =
      await this.scope.assertJobApplicationInScope(jobApplicationId);

    if (application.version !== command.expectedVersion) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_STATE_CHANGED,
        'Job application was modified by another request',
      );
    }

    const opening = await this.prisma.jobOpening.findUniqueOrThrow({
      where: { id: application.jobOpeningId },
      select: { companyId: true },
    });

    return this.receipts.claimOrReplay({
      companyId: opening.companyId,
      commandType,
      jobApplicationId,
      expectedVersion: command.expectedVersion,
      operationId: command.operationId,
      reasonCode: command.reasonCode ?? meta?.reasonCode,
      comment: command.comment ?? meta?.comment,
      execute: async (tx) => {
        const locked = await tx.jobApplication.findUniqueOrThrow({
          where: { id: application.id },
        });
        if (locked.version !== command.expectedVersion) {
          throw new DomainConflictException(
            RECRUITMENT_ERROR_CODES.APPLICATION_STATE_CHANGED,
            'Job application was modified by another request',
          );
        }

        const updated = await this.transitionInTransaction(
          tx,
          locked,
          targetStatus,
          meta,
        );

        const result: JobApplicationTransitionResult = {
          record: updated,
          version: updated.version,
          allowedActions: await this.allowedActionsFor(
            updated.status,
            opening.companyId,
          ),
        };

        return {
          result,
          snapshot: result as unknown as Prisma.InputJsonValue,
        };
      },
    });
  }

  private async transition(
    jobApplicationId: string,
    targetStatus: JobApplicationStatus,
    expectedVersion?: number,
    meta?: {
      reasonCode?: string;
      comment?: string;
      shortlistedAt?: Date;
      screeningStartedAt?: Date;
      selectedAt?: Date;
      offerSentAt?: Date;
      offerAcceptedAt?: Date;
      hiredAt?: Date;
      actorType?: RecruitmentActorType;
      actorId?: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<JobApplicationTransitionResult> {
    const application =
      await this.scope.assertJobApplicationInScope(jobApplicationId);

    if (
      expectedVersion !== undefined &&
      application.version !== expectedVersion
    ) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.APPLICATION_STATE_CHANGED,
        'Job application was modified by another request',
      );
    }

    const run = async (client: Prisma.TransactionClient) =>
      this.transitionInTransaction(client, application, targetStatus, meta);

    const updated = tx ? await run(tx) : await this.prisma.$transaction(run);

    return {
      record: updated,
      version: updated.version,
      allowedActions: await this.allowedActionsFor(
        updated.status,
        application.jobOpening.companyId,
      ),
    };
  }

  async withAllowedActions(
    application: JobApplication,
    companyId: string | null | undefined,
  ): Promise<JobApplicationTransitionResult> {
    return {
      record: application,
      version: application.version,
      allowedActions: await this.allowedActionsFor(
        application.status,
        companyId,
      ),
    };
  }
}
