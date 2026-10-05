import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryAttemptOutcome,
  DeliveryChannel,
  DeliveryMessageStatus,
  DeliveryProvider,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UserNotificationService } from '../notification/user-notification.service';
import { DeliveryClaimService } from './delivery-claim.service';
import { resolveInAppNotificationDedupeKey } from './delivery-inapp-dedupe.util';

/**
 * Polls claimed IN_APP delivery_messages and writes them to user_notifications.
 * In-app delivery is best-effort: retry at most twice, then DEAD_LETTER.
 */
@Injectable()
export class DeliveryInAppWorker {
  private readonly logger = new Logger(DeliveryInAppWorker.name);

  private static readonly MAX_ATTEMPTS = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userNotificationService: UserNotificationService,
    private readonly claimService: DeliveryClaimService,
  ) {}

  async processBatch(batchSize = 50): Promise<{
    claimed: number;
    processed: number;
    failed: number;
    deadLettered: number;
    bypassed: number;
  }> {
    const { workerId, workerCorrelationId } =
      this.claimService.createWorkerIdentity('inapp');
    const claimedIds = await this.claimService.claimBatch({
      channel: DeliveryChannel.IN_APP,
      batchSize,
      workerId,
    });

    let processed = 0;
    let failed = 0;
    let deadLettered = 0;
    let bypassed = 0;

    if (claimedIds.length === 0) {
      return { claimed: 0, processed, failed, deadLettered, bypassed };
    }

    const messages = await this.prisma.deliveryMessage.findMany({
      where: { id: { in: claimedIds } },
      orderBy: { nextAttemptAt: 'asc' },
    });

    for (const message of messages) {
      if (
        !(await this.claimService.isAllowedScope(
          message.companyId,
          message.branchId,
        ))
      ) {
        await this.prisma.deliveryMessage.update({
          where: { id: message.id },
          data: {
            status: DeliveryMessageStatus.RETRY_WAIT,
            nextAttemptAt: new Date(Date.now() + 60_000),
            lastErrorCode: 'COMPANY_MODULE_NOT_ENABLED',
            lastErrorClass: 'SCOPE',
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            version: { increment: 1 },
          },
        });
        bypassed += 1;
        continue;
      }

      const attemptNo = message.attemptCount + 1;
      const recipientUserId = message.recipientUserId ?? message.recipientId;
      const startMs = Date.now();

      try {
        const notifDedupeKey = resolveInAppNotificationDedupeKey({
          messageDedupeKey: message.dedupeKey,
          recipientUserId,
        });

        await this.userNotificationService.create({
          userId: recipientUserId,
          companyGroupId: message.companyGroupId,
          companyId: message.companyId,
          branchId: message.branchId,
          eventCode: message.eventType ?? message.outboxEventType,
          dedupeKey: notifDedupeKey,
          entityType: message.aggregateType,
          entityId: message.aggregateId,
        });

        await this.prisma.$transaction(async (tx) => {
          await tx.deliveryAttempt.create({
            data: {
              deliveryMessageId: message.id,
              attemptNo,
              provider: DeliveryProvider.INTERNAL,
              outcome: DeliveryAttemptOutcome.DELIVERED,
              clientReference: message.id,
              workerCorrelationId,
              startedAt: new Date(startMs),
              completedAt: new Date(),
              durationMs: Date.now() - startMs,
            },
          });

          await tx.deliveryMessage.update({
            where: { id: message.id },
            data: {
              status: DeliveryMessageStatus.DELIVERED,
              attemptCount: attemptNo,
              firstAttemptAt: message.firstAttemptAt ?? new Date(),
              lastAttemptAt: new Date(),
              deliveredAt: new Date(),
              terminalAt: new Date(),
              clientReference: message.id,
              lockedBy: null,
              lockedAt: null,
              lockExpiresAt: null,
              version: { increment: 1 },
            },
          });
        });

        processed += 1;
      } catch (error) {
        const errorCode =
          error instanceof Error ? error.name : 'UNKNOWN_IN_APP_ERROR';

        const isDeadLetter = attemptNo >= DeliveryInAppWorker.MAX_ATTEMPTS;

        await this.prisma.$transaction(async (tx) => {
          await tx.deliveryAttempt.create({
            data: {
              deliveryMessageId: message.id,
              attemptNo,
              provider: DeliveryProvider.INTERNAL,
              outcome: DeliveryAttemptOutcome.TRANSIENT_FAILURE,
              errorClass: 'TRANSIENT',
              errorCode,
              workerCorrelationId,
              startedAt: new Date(startMs),
              completedAt: new Date(),
            },
          });

          await tx.deliveryMessage.update({
            where: { id: message.id },
            data: {
              status: isDeadLetter
                ? DeliveryMessageStatus.DEAD_LETTER
                : DeliveryMessageStatus.RETRY_WAIT,
              attemptCount: attemptNo,
              firstAttemptAt: message.firstAttemptAt ?? new Date(),
              lastAttemptAt: new Date(),
              lastErrorCode: errorCode,
              lastErrorClass: 'TRANSIENT',
              lockedBy: null,
              lockedAt: null,
              lockExpiresAt: null,
              ...(isDeadLetter
                ? { terminalAt: new Date(), deadLetteredAt: new Date() }
                : { nextAttemptAt: new Date(Date.now() + 60_000) }),
              version: { increment: 1 },
            },
          });
        });

        if (isDeadLetter) {
          deadLettered += 1;
          this.logger.warn({
            event: 'delivery.inapp.dead_lettered',
            deliveryMessageId: message.id,
            workerCorrelationId,
          });
        } else {
          failed += 1;
        }
      }
    }

    this.logger.log({
      event: 'delivery.inapp.batch_complete',
      claimed: claimedIds.length,
      processed,
      failed,
      deadLettered,
      bypassed,
      workerCorrelationId,
    });

    return {
      claimed: claimedIds.length,
      processed,
      failed,
      deadLettered,
      bypassed,
    };
  }
}
