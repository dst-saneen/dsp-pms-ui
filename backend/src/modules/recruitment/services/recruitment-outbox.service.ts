import { Injectable } from '@nestjs/common';

import {
  OutboxWriterService,
  PrismaTx,
} from '../../outbox/outbox-writer.service';

export type RecruitmentOutboxEventType =
  | 'recruitment.application.received'
  | 'recruitment.interview.scheduled'
  | 'recruitment.interview.rescheduled'
  | 'recruitment.interview.cancelled'
  | 'recruitment.evaluation.due'
  | 'recruitment.manager.decision.due'
  | 'recruitment.offer.sent'
  | 'recruitment.offer.accepted'
  | 'recruitment.offer.declined'
  | 'recruitment.offer.signature.submitted'
  | 'recruitment.offer.signature.verified'
  | 'recruitment.offer.signature.rejected'
  | 'recruitment.offer.signature.resubmission.requested'
  | 'recruitment.ready_to_hire'
  | 'recruitment.conversion.completed'
  | 'recruitment.employee.invitation'
  | 'recruitment.probation.due';

export interface RecruitmentOutboxContext {
  companyGroupId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  jobOpeningId?: string;
  jobApplicationId?: string;
  candidateId?: string;
  interviewSessionId?: string;
  jobOfferId?: string;
  submissionId?: string;
  employeeId?: string;
  invitationId?: string;
  userId?: string;
  recipientUserIds?: string[];
  eventCode?: string;
  deliveryAttemptId?: string;
}

@Injectable()
export class RecruitmentOutboxService {
  constructor(private readonly outboxWriter: OutboxWriterService) {}

  async enqueue(
    tx: PrismaTx,
    eventType: RecruitmentOutboxEventType,
    aggregateId: string,
    context: RecruitmentOutboxContext,
    dedupeKey: string,
  ): Promise<void> {
    await this.outboxWriter.write(tx, {
      aggregateType: 'recruitment',
      aggregateId,
      eventType,
      dedupeKey,
      companyGroupId: context.companyGroupId,
      companyId: context.companyId,
      branchId: context.branchId,
      payload: {
        eventCode: eventType,
        jobOpeningId: context.jobOpeningId,
        jobApplicationId: context.jobApplicationId,
        candidateId: context.candidateId,
        interviewSessionId: context.interviewSessionId,
        jobOfferId: context.jobOfferId,
        submissionId: context.submissionId,
        employeeId: context.employeeId,
        invitationId: context.invitationId,
        userId: context.userId,
        recipientUserIds: context.recipientUserIds,
        deliveryAttemptId: context.deliveryAttemptId,
      },
    });
  }
}
