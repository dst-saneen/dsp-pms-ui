import {
  Injectable,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxEvent, OutboxEventStatus, UserStatus } from '@prisma/client';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserNotificationService } from '../notification/user-notification.service';
import {
  notificationCopy,
  WorkforceNotificationEventCode,
} from '../notification/notification-event.catalog';
import { resolveNotificationHref } from '../notification/notification-href';
import { RecruitmentDeliveryProcessor } from '../recruitment/services/recruitment-delivery.processor';
import { DeliveryFanoutService } from '../delivery/delivery-fanout.service';
import { DeliveryFeatureGateService } from '../delivery/delivery-feature-gate.service';
import {
  PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED,
  PayrollPayslipWorkerService,
} from '../payroll/services/payroll-payslip-worker.service';
import { PAYROLL_ERROR_CODES } from '../payroll/policies/payroll-error-codes';
import { legacyOutboxShouldSendEmail } from '../delivery/resolution/delivery-event.registry';
import { TransactionalMailService } from '../mail/transactional-mail.service';

interface OutboxHandlingResult {
  /**
   * A terminal, intentionally skipped event keeps its operational reason
   * without being retried as a handler failure.
   */
  terminalCode?: string;
}

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
    @Inject(forwardRef(() => UserNotificationService))
    private readonly userNotificationService: UserNotificationService,
    @Inject(forwardRef(() => RecruitmentDeliveryProcessor))
    private readonly recruitmentDeliveryProcessor: RecruitmentDeliveryProcessor,
    @Optional()
    @Inject(forwardRef(() => DeliveryFanoutService))
    private readonly deliveryFanout?: DeliveryFanoutService,
    @Optional()
    @Inject(forwardRef(() => DeliveryFeatureGateService))
    private readonly deliveryGate?: DeliveryFeatureGateService,
    @Optional()
    @Inject(forwardRef(() => PayrollPayslipWorkerService))
    private readonly payslipWorker?: PayrollPayslipWorkerService,
    @Optional()
    private readonly mail?: TransactionalMailService,
  ) {}

  async processBatch(limit?: number): Promise<{
    claimed: number;
    processed: number;
    failed: number;
    recovered: number;
  }> {
    const batchSize =
      limit ??
      this.configService.get('WORKFORCE_JOB_BATCH_SIZE', { infer: true });
    const lockTimeoutSeconds = this.configService.get(
      'WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS',
      { infer: true },
    );

    const recovered = await this.recoverAbandonedLocks(lockTimeoutSeconds);
    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: new Date() },
      },
      orderBy: { availableAt: 'asc' },
      take: batchSize,
    });

    let claimed = 0;
    let processed = 0;
    let failed = 0;

    for (const candidate of candidates) {
      const claim = await this.prisma.outboxEvent.updateMany({
        where: {
          id: candidate.id,
          status: OutboxEventStatus.PENDING,
        },
        data: {
          status: OutboxEventStatus.PROCESSING,
          lockedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      if (claim.count !== 1) {
        continue;
      }
      claimed += 1;

      try {
        const handlingResult = await this.handleEvent(candidate);
        await this.prisma.outboxEvent.update({
          where: { id: candidate.id },
          data: {
            status: OutboxEventStatus.PROCESSED,
            processedAt: new Date(),
            lockedAt: null,
            lastErrorCode: handlingResult?.terminalCode ?? null,
          },
        });
        if (handlingResult?.terminalCode) {
          this.logger.warn(
            `Outbox event intentionally skipped id=${candidate.id} eventType=${candidate.eventType} code=${handlingResult.terminalCode}`,
          );
        }
        processed += 1;
      } catch (error) {
        const errorCode =
          error instanceof Error && 'code' in error
            ? String(
                (error as { code?: string }).code ?? 'OUTBOX_HANDLER_FAILED',
              )
            : 'OUTBOX_HANDLER_FAILED';
        const attempts = candidate.attempts + 1;
        const backoffSeconds = Math.min(3600, 30 * attempts);
        await this.prisma.outboxEvent.update({
          where: { id: candidate.id },
          data: {
            status:
              attempts >= 10
                ? OutboxEventStatus.FAILED
                : OutboxEventStatus.PENDING,
            lockedAt: null,
            lastErrorCode: errorCode.slice(0, 64),
            availableAt: new Date(Date.now() + backoffSeconds * 1000),
          },
        });
        failed += 1;
        this.logger.warn(
          `Outbox event failed id=${candidate.id} eventType=${candidate.eventType} code=${errorCode}`,
        );
      }
    }

    this.logger.log(
      `Outbox batch claimed=${claimed} processed=${processed} failed=${failed} recovered=${recovered}`,
    );

    return { claimed, processed, failed, recovered };
  }

  private async recoverAbandonedLocks(
    lockTimeoutSeconds: number,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - lockTimeoutSeconds * 1000);
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxEventStatus.PROCESSING,
        lockedAt: { lt: cutoff },
      },
      data: {
        status: OutboxEventStatus.PENDING,
        lockedAt: null,
        availableAt: new Date(),
        lastErrorCode: 'OUTBOX_LOCK_ABANDONED',
      },
    });
    return result.count;
  }

  private async handleEvent(
    event: OutboxEvent,
  ): Promise<OutboxHandlingResult | void> {
    if (event.eventType === 'payroll.payslip.generate') {
      if (!event.companyId) {
        throw new Error('PAYSLIP_COMPANY_MISSING');
      }
      if (!this.payslipWorker) {
        throw new Error('PAYSLIP_WORKER_UNAVAILABLE');
      }
      const outcome = await this.payslipWorker.processGenerateEvent({
        payslipId: event.aggregateId,
        companyId: event.companyId,
      });
      if (outcome === PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED) {
        return { terminalCode: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED };
      }
      return;
    }

    // Delivery is a Company module. When enabled, fan-out owns the event;
    // otherwise the established in-app/recruitment notification path remains.
    const deliveryEnabled =
      Boolean(this.deliveryFanout) &&
      Boolean(this.deliveryGate) &&
      (await this.deliveryGate!.isEnabledForCompany(event.companyId));

    if (deliveryEnabled && this.deliveryFanout) {
      await this.deliveryFanout.fanOut(event);
      return;
    }

    if (event.eventType.startsWith('recruitment.')) {
      await this.recruitmentDeliveryProcessor.process(event);
      return;
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const recipientUserIds = await this.resolveRecipientUserIds(event, payload);
    const shouldEmail = legacyOutboxShouldSendEmail(event.eventType);

    for (const userId of recipientUserIds) {
      await this.userNotificationService.create({
        userId,
        companyGroupId: event.companyGroupId,
        companyId: event.companyId,
        branchId: event.branchId,
        eventCode: event.eventType,
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        dedupeKey: `notification:${event.dedupeKey}:user:${userId}`,
      });

      if (shouldEmail) {
        await this.sendLegacySmtpNotification(event, userId);
      }
    }
  }

  private async sendLegacySmtpNotification(
    event: OutboxEvent,
    userId: string,
  ): Promise<void> {
    if (!this.mail?.isAvailable()) {
      this.logger.debug(
        `Skipping SMTP notification eventType=${event.eventType} userId=${userId} (mail unavailable)`,
      );
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !user.email?.trim()) {
      this.logger.debug(
        `Skipping SMTP notification eventType=${event.eventType} userId=${userId} (inactive or no email)`,
      );
      return;
    }

    const copy = notificationCopy(event.eventType);
    const frontendUrl = this.configService
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/$/, '');
    const href = resolveNotificationHref(
      event.eventType,
      event.aggregateType,
      event.aggregateId,
    );
    const actionUrl = href ? `${frontendUrl}${href}` : null;
    const displayName = user.displayName?.trim() || user.username || user.email;

    try {
      await this.mail.sendNotificationAlert({
        to: user.email.trim(),
        displayName,
        subject: copy.title,
        message: copy.message,
        actionUrl,
        clientReference: `outbox:${event.id}:user:${userId}`,
      });
    } catch (error) {
      // In-app already succeeded — do not fail the outbox event on SMTP errors.
      this.logger.warn(
        `SMTP notification failed eventType=${event.eventType} userId=${userId} error=${
          error instanceof Error ? error.name : 'UnknownEmailError'
        }`,
      );
    }
  }

  private async resolveRecipientUserIds(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    const fromPayload = payload.recipientUserIds;
    if (Array.isArray(fromPayload) && fromPayload.length > 0) {
      return fromPayload.filter((id): id is string => typeof id === 'string');
    }

    const recipientUserId =
      typeof payload.recipientUserId === 'string'
        ? payload.recipientUserId
        : null;
    if (recipientUserId) {
      return [recipientUserId];
    }

    const employeeId =
      typeof payload.employeeId === 'string' ? payload.employeeId : null;
    if (employeeId) {
      if (
        event.eventType ===
        WorkforceNotificationEventCode.LEAVE_REQUEST_SUBMITTED
      ) {
        return [];
      }
      const user = await this.prisma.user.findFirst({
        where: { employeeId, status: 'ACTIVE' },
        select: { id: true },
      });
      return user ? [user.id] : [];
    }

    // Branch-scoped roster events: notify active users in the branch with linked employees.
    if (
      event.branchId &&
      (event.eventType ===
        WorkforceNotificationEventCode.SHIFT_ROSTER_PUBLISHED ||
        event.eventType ===
          WorkforceNotificationEventCode.SHIFT_ROSTER_LOCKED ||
        event.eventType ===
          WorkforceNotificationEventCode.SHIFT_ROSTER_ARCHIVED)
    ) {
      const users = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          employee: {
            isActive: true,
            branchId: event.branchId,
          },
        },
        select: { id: true },
        take: 500,
      });
      return users.map((user) => user.id);
    }

    return [];
  }
}
