import { Injectable, Logger } from '@nestjs/common';

import {
  OutboxWriterService,
  PrismaTx,
} from '../../outbox/outbox-writer.service';

import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';

export type OnboardingNotificationEventCode =
  | 'ONBOARDING_STARTED'
  | 'ONBOARDING_DEPARTMENT_WORK_AVAILABLE'
  | 'ONBOARDING_DEPARTMENT_NO_ASSIGNER'
  | 'ONBOARDING_TASK_ASSIGNED'
  | 'ONBOARDING_TASK_REASSIGNED'
  | 'ONBOARDING_TASK_UNASSIGNED'
  | 'ONBOARDING_TASK_DUE_SOON'
  | 'ONBOARDING_TASK_OVERDUE'
  | 'ONBOARDING_TASK_COMPLETED'
  | 'ONBOARDING_TASK_WAIVED'
  | 'ONBOARDING_CANCELLED'
  | 'ONBOARDING_COMPLETED';

export interface OnboardingNotificationPayload {
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
  onboardingId?: string | null;
  onboardingTaskId?: string | null;
  /** Hint only — Delivery must not authorize from this field. */
  recipientUserId?: string | null;
  eventCode: OnboardingNotificationEventCode;
  status?: string | null;
  dueDate?: string | null;
}

@Injectable()
export class OnboardingNotificationService {
  private readonly logger = new Logger(OnboardingNotificationService.name);

  constructor(
    private readonly featureGate: OnboardingFeatureGateService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async enqueueInTransaction(
    tx: PrismaTx,
    input: OnboardingNotificationPayload,
    dedupeKey: string,
  ): Promise<{ created: boolean }> {
    if (
      input.companyId &&
      !(await this.featureGate.isEnabledForContext(
        input.companyId,
        input.branchId ?? undefined,
      ))
    ) {
      return { created: false };
    }

    const result = await this.outboxWriter.write(tx, {
      aggregateType: 'onboarding',
      aggregateId:
        input.onboardingId ??
        input.onboardingTaskId ??
        input.employeeId ??
        input.eventCode,
      eventType: input.eventCode,
      dedupeKey,
      companyId: input.companyId,
      branchId: input.branchId,
      payload: {
        companyId: input.companyId,
        branchId: input.branchId,
        departmentId: input.departmentId,
        employeeId: input.employeeId,
        onboardingId: input.onboardingId,
        onboardingTaskId: input.onboardingTaskId,
        recipientUserId: input.recipientUserId,
        eventCode: input.eventCode,
        status: input.status,
        dueDate: input.dueDate,
      },
    });

    this.logger.debug(
      `Queued onboarding notification ${input.eventCode} aggregate=${input.onboardingId ?? input.onboardingTaskId}`,
    );

    return { created: result.created };
  }

  buildTaskActionDedupeKey(
    eventCode: OnboardingNotificationEventCode,
    taskId: string,
    businessDate: string,
    recipientUserId?: string | null,
  ): string {
    const recipientPart = recipientUserId ? `:user:${recipientUserId}` : '';
    return `onboarding:${eventCode}:${taskId}:${businessDate}${recipientPart}`;
  }

  buildLifecycleDedupeKey(
    eventCode: OnboardingNotificationEventCode,
    onboardingId: string,
  ): string {
    return `onboarding:${eventCode}:${onboardingId}`;
  }
}
