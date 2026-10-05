import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryAttemptOutcome,
  DeliveryChannel,
  DeliveryMessage,
  DeliveryMessageStatus,
  DeliveryProvider,
} from '@prisma/client';

import { DomainConflictException } from '../../common';
import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { createHmac } from 'node:crypto';
import {
  type DeliveryEmailErrorClass,
  TransactionalMailService,
} from '../mail/transactional-mail.service';
import { DeliveryClaimService } from './delivery-claim.service';
import { DeliveryCryptoService } from './delivery-crypto.service';
import { DeliverySuppressionService } from './delivery-suppression.service';

/**
 * Retry schedule (seconds after each failed attempt).
 * Attempt 1 → +60s, 2 → +300s, 3 → +900s, 4 → +3600s, 5 → +21600s, 6 → +86400s
 * After 6 attempts the message moves to DEAD_LETTER.
 */
const RETRY_SCHEDULE_SECONDS = [60, 300, 900, 3_600, 21_600, 86_400];

const MAX_ATTEMPTS = RETRY_SCHEDULE_SECONDS.length;

@Injectable()
export class DeliveryEmailWorker {
  private readonly logger = new Logger(DeliveryEmailWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: TransactionalMailService,
    private readonly suppression: DeliverySuppressionService,
    private readonly claimService: DeliveryClaimService,
    private readonly crypto: DeliveryCryptoService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  /**
   * Claim + process one batch of EMAIL messages for entitled Companies.
   * Sends from the sealed snapshot only — never re-renders mutable domain data.
   */
  async processBatch(batchSize = 20): Promise<{
    claimed: number;
    processed: number;
    failed: number;
    deadLettered: number;
    bypassed: number;
    accepted: number;
  }> {
    const { workerId, workerCorrelationId } =
      this.claimService.createWorkerIdentity('email');
    const claimedIds = await this.claimService.claimBatch({
      channel: DeliveryChannel.EMAIL,
      batchSize,
      workerId,
    });

    let processed = 0;
    let failed = 0;
    let deadLettered = 0;
    let bypassed = 0;
    let accepted = 0;

    if (claimedIds.length === 0) {
      return {
        claimed: 0,
        processed,
        failed,
        deadLettered,
        bypassed,
        accepted,
      };
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
        await this.releaseWithoutSend(message.id, 'COMPANY_MODULE_NOT_ENABLED');
        bypassed += 1;
        continue;
      }

      const opened = this.openSnapshot(message);
      if (!opened) {
        await this.failPermanent(
          message,
          Math.max(1, message.attemptCount + 1),
          workerCorrelationId,
          Date.now(),
          'MISSING_CONTENT_SNAPSHOT',
        );
        deadLettered += 1;
        continue;
      }

      const suppressed = await this.isAddressSuppressed(
        opened.toAddress,
        message,
      );
      if (suppressed) {
        await this.prisma.deliveryMessage.update({
          where: { id: message.id },
          data: {
            status: DeliveryMessageStatus.BYPASSED,
            bypassReason: 'EMAIL_SUPPRESSED',
            terminalAt: new Date(),
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            version: { increment: 1 },
          },
        });
        bypassed += 1;
        this.logger.warn({
          event: 'delivery.email.bypassed_suppressed',
          deliveryMessageId: message.id,
          workerCorrelationId,
        });
        continue;
      }

      const attemptNo = message.attemptCount + 1;
      const startMs = Date.now();
      const selectedProvider = this.mail.getDeliveryProvider();

      try {
        const clientReference = message.clientReference ?? message.id;

        const result = await this.mail.sendDeliveryMessage({
          to: opened.toAddress,
          displayName: message.toDisplayName ?? opened.toAddress,
          subject: opened.subject,
          text: opened.bodyText,
          html: opened.bodyHtml,
          clientReference,
        });

        if (result.disposition === 'BYPASSED') {
          await this.markDevelopmentBypass(message.id, workerCorrelationId);
          bypassed += 1;
          continue;
        }

        const durationMs = Date.now() - startMs;

        await this.prisma.$transaction(async (tx) => {
          await tx.deliveryAttempt.create({
            data: {
              deliveryMessageId: message.id,
              attemptNo,
              provider: result.provider,
              outcome: DeliveryAttemptOutcome.ACCEPTED,
              providerRequestId: result.requestId,
              providerEmailReference: result.emailReference,
              clientReference,
              workerCorrelationId,
              startedAt: new Date(startMs),
              completedAt: new Date(),
              durationMs,
            },
          });

          await tx.deliveryMessage.update({
            where: { id: message.id },
            data: {
              status: DeliveryMessageStatus.ACCEPTED,
              attemptCount: attemptNo,
              firstAttemptAt: message.firstAttemptAt ?? new Date(),
              lastAttemptAt: new Date(),
              acceptedAt: new Date(),
              provider: result.provider,
              providerMessageId: result.emailReference,
              providerRequestId: result.requestId,
              providerEmailReference: result.emailReference,
              clientReference,
              lockedBy: null,
              lockedAt: null,
              lockExpiresAt: null,
              lastErrorCode: null,
              lastErrorClass: null,
              version: { increment: 1 },
            },
          });

          if (
            message.eventType === 'recruitment.employee.invitation' &&
            message.aggregateId
          ) {
            await tx.userInvitation.updateMany({
              where: {
                id: message.aggregateId,
                sentAt: null,
              },
              data: { sentAt: new Date() },
            });
          }
        });

        accepted += 1;
        processed += 1;

        this.logger.log({
          event: 'delivery.email.accepted',
          deliveryMessageId: message.id,
          attemptNo,
          requestId: result.requestId,
          workerCorrelationId,
        });
      } catch (error) {
        const durationMs = Date.now() - startMs;
        const failure = this.classifySendFailure(error);
        const clientReference = message.clientReference ?? message.id;

        if (failure.errorClass === 'AMBIGUOUS') {
          await this.prisma.$transaction(async (tx) => {
            await tx.deliveryAttempt.create({
              data: {
                deliveryMessageId: message.id,
                attemptNo,
                provider: selectedProvider,
                outcome: DeliveryAttemptOutcome.AMBIGUOUS,
                errorClass: 'AMBIGUOUS',
                errorCode: failure.providerCode,
                providerStatusCode: failure.providerStatusCode,
                clientReference,
                workerCorrelationId,
                startedAt: new Date(startMs),
                completedAt: new Date(),
                durationMs,
              },
            });

            await tx.deliveryMessage.update({
              where: { id: message.id },
              data: {
                status: DeliveryMessageStatus.RECONCILING,
                attemptCount: attemptNo,
                provider: selectedProvider,
                firstAttemptAt: message.firstAttemptAt ?? new Date(),
                lastAttemptAt: new Date(),
                lastErrorCode: failure.providerCode,
                lastErrorClass: 'AMBIGUOUS',
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                version: { increment: 1 },
              },
            });
          });

          this.logger.warn({
            event: 'delivery.email.reconciling',
            deliveryMessageId: message.id,
            attemptNo,
            providerCode: failure.providerCode,
            workerCorrelationId,
          });
          failed += 1;
          continue;
        }

        const isPermanent = failure.errorClass === 'PERMANENT';
        const outcome: DeliveryAttemptOutcome = isPermanent
          ? DeliveryAttemptOutcome.PERMANENT_FAILURE
          : DeliveryAttemptOutcome.TRANSIENT_FAILURE;

        await this.prisma.$transaction(async (tx) => {
          await tx.deliveryAttempt.create({
            data: {
              deliveryMessageId: message.id,
              attemptNo,
              provider: selectedProvider,
              outcome,
              errorClass: isPermanent ? 'PERMANENT' : 'TRANSIENT',
              errorCode: failure.providerCode,
              providerStatusCode: failure.providerStatusCode,
              clientReference,
              workerCorrelationId,
              startedAt: new Date(startMs),
              completedAt: new Date(),
              durationMs,
            },
          });

          const isDeadLetter = isPermanent || attemptNo >= MAX_ATTEMPTS;

          if (isDeadLetter) {
            await tx.deliveryMessage.update({
              where: { id: message.id },
              data: {
                status: DeliveryMessageStatus.DEAD_LETTER,
                attemptCount: attemptNo,
                provider: selectedProvider,
                lastAttemptAt: new Date(),
                firstAttemptAt: message.firstAttemptAt ?? new Date(),
                lastErrorCode: failure.providerCode,
                lastErrorClass: isPermanent ? 'PERMANENT' : 'TRANSIENT',
                terminalAt: new Date(),
                deadLetteredAt: new Date(),
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                version: { increment: 1 },
              },
            });
          } else {
            const retryDelaySec =
              RETRY_SCHEDULE_SECONDS[attemptNo - 1] ?? 86_400;
            await tx.deliveryMessage.update({
              where: { id: message.id },
              data: {
                status: DeliveryMessageStatus.RETRY_WAIT,
                attemptCount: attemptNo,
                provider: selectedProvider,
                firstAttemptAt: message.firstAttemptAt ?? new Date(),
                lastAttemptAt: new Date(),
                lastErrorCode: failure.providerCode,
                lastErrorClass: 'TRANSIENT',
                nextAttemptAt: new Date(Date.now() + retryDelaySec * 1_000),
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                version: { increment: 1 },
              },
            });
          }
        });

        if (isPermanent || attemptNo >= MAX_ATTEMPTS) {
          deadLettered += 1;
          this.logger.warn({
            event: 'delivery.ops.alert',
            alertType: 'EMAIL_DEAD_LETTER',
            deliveryMessageId: message.id,
            attemptNo,
            isPermanent,
            providerCode: failure.providerCode,
            workerCorrelationId,
          });
        } else {
          failed += 1;
          this.logger.warn({
            event: 'delivery.email.retrying',
            deliveryMessageId: message.id,
            attemptNo,
            providerCode: failure.providerCode,
            workerCorrelationId,
          });
        }
      }
    }

    this.logger.log({
      event: 'delivery.email.batch_complete',
      claimed: claimedIds.length,
      processed,
      accepted,
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
      accepted,
    };
  }

  /**
   * Prefer sealed snapshot. Fall back to expand-period plaintext only.
   * Never reloads Offer/Candidate/Interview to rebuild the body.
   */
  private openSnapshot(message: DeliveryMessage): {
    toAddress: string;
    subject: string;
    bodyText: string;
    bodyHtml: string;
  } | null {
    try {
      if (
        message.recipientAddressCiphertext &&
        message.recipientAddressNonce &&
        message.recipientAddressAuthTag &&
        message.recipientAddressKeyVersion
      ) {
        const content = this.crypto.openEmailContent(message);
        if (!content) {
          return null;
        }
        const toAddress = this.crypto.openAddress(
          {
            ciphertext: message.recipientAddressCiphertext,
            nonce: message.recipientAddressNonce,
            authTag: message.recipientAddressAuthTag,
            keyVersion: message.recipientAddressKeyVersion,
          },
          {
            messageId: message.id,
            companyId: message.companyId,
            channel: message.channel,
            templateKey: message.templateKey,
            templateVersion: message.templateVersion,
          },
        );
        return {
          toAddress,
          subject: content.subject,
          bodyText: content.bodyText,
          bodyHtml: content.bodyHtml,
        };
      }
    } catch (error) {
      this.logger.warn({
        event: 'delivery.email.snapshot_open_failed',
        deliveryMessageId: message.id,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return null;
    }

    if (!message.toAddress || !message.subject) {
      return null;
    }
    const name = message.toDisplayName ?? 'there';
    return {
      toAddress: message.toAddress,
      subject: message.subject,
      bodyText: `Hello ${name},\n\n${message.subject}\n`,
      bodyHtml: `<p>Hello ${name},</p><p>${message.subject}</p>`,
    };
  }

  private classifySendFailure(error: unknown): {
    errorClass: DeliveryEmailErrorClass;
    providerCode: string;
    providerStatusCode?: number;
  } {
    const maybe = error as {
      errorClass?: DeliveryEmailErrorClass;
      providerCode?: string;
      isPermanent?: boolean;
      isAmbiguous?: boolean;
      response?: { code?: string };
      providerStatusCode?: number;
      statusCode?: number;
    };
    const providerStatusCode =
      maybe?.providerStatusCode ?? maybe?.statusCode ?? undefined;

    if (maybe?.errorClass === 'AMBIGUOUS' || maybe?.isAmbiguous === true) {
      return {
        errorClass: 'AMBIGUOUS',
        providerCode: maybe.providerCode ?? 'EMAIL_TIMEOUT_AMBIGUOUS',
        providerStatusCode,
      };
    }
    if (maybe?.errorClass === 'PERMANENT' || maybe?.isPermanent === true) {
      return {
        errorClass: 'PERMANENT',
        providerCode:
          maybe.providerCode ?? maybe.response?.code ?? 'EMAIL_PERMANENT_ERROR',
        providerStatusCode,
      };
    }
    if (maybe?.errorClass === 'TRANSIENT') {
      return {
        errorClass: 'TRANSIENT',
        providerCode:
          maybe.providerCode ?? maybe.response?.code ?? 'EMAIL_TRANSIENT_ERROR',
        providerStatusCode,
      };
    }

    return {
      errorClass: 'TRANSIENT',
      providerCode:
        maybe?.providerCode ??
        maybe?.response?.code ??
        (error instanceof Error ? error.name : 'UNKNOWN_ERROR'),
      providerStatusCode,
    };
  }

  private async isAddressSuppressed(
    toAddress: string,
    message: DeliveryMessage,
  ): Promise<boolean> {
    if (message.recipientAddressHmac) {
      const byHmac = await this.suppression.isSuppressedHmac(
        message.recipientAddressHmac,
        message.companyGroupId,
      );
      if (byHmac) {
        return true;
      }
    }
    return this.suppression.isSuppressed(toAddress, message.companyId);
  }

  private async failPermanent(
    message: DeliveryMessage,
    attemptNo: number,
    workerCorrelationId: string,
    startMs: number,
    errorCode: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryAttempt.create({
        data: {
          deliveryMessageId: message.id,
          attemptNo,
          // No provider was contacted when the snapshot could not be opened.
          provider: DeliveryProvider.NONE,
          outcome: DeliveryAttemptOutcome.PERMANENT_FAILURE,
          errorClass: 'PERMANENT',
          errorCode,
          workerCorrelationId,
          startedAt: new Date(startMs),
          completedAt: new Date(),
          durationMs: Date.now() - startMs,
        },
      });
      await tx.deliveryMessage.update({
        where: { id: message.id },
        data: {
          status: DeliveryMessageStatus.DEAD_LETTER,
          attemptCount: attemptNo,
          provider: DeliveryProvider.NONE,
          lastAttemptAt: new Date(),
          firstAttemptAt: message.firstAttemptAt ?? new Date(),
          lastErrorCode: errorCode,
          lastErrorClass: 'PERMANENT',
          terminalAt: new Date(),
          deadLetteredAt: new Date(),
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          version: { increment: 1 },
        },
      });
    });
  }

  private async releaseWithoutSend(
    deliveryMessageId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.deliveryMessage.update({
      where: { id: deliveryMessageId },
      data: {
        status: DeliveryMessageStatus.RETRY_WAIT,
        nextAttemptAt: new Date(Date.now() + 60_000),
        lastErrorCode: reason,
        lastErrorClass: 'SCOPE',
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        version: { increment: 1 },
      },
    });
  }

  private async markDevelopmentBypass(
    deliveryMessageId: string,
    workerCorrelationId: string,
  ): Promise<void> {
    await this.prisma.deliveryMessage.update({
      where: { id: deliveryMessageId },
      data: {
        // The configured transport was never contacted. Preserve that fact in
        // the terminal record rather than treating a local bypass as accepted.
        provider: DeliveryProvider.NONE,
        status: DeliveryMessageStatus.BYPASSED,
        bypassReason: 'EMAIL_DEV_BYPASS',
        terminalAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        version: { increment: 1 },
      },
    });
    this.logger.warn({
      event: 'delivery.email.bypassed_development',
      deliveryMessageId,
      workerCorrelationId,
    });
  }

  /**
   * Manual retry never moves RECONCILING mail back to the queue. An ambiguous
   * provider result requires a separately authenticated provider-log decision
   * before it can be resent.
   * Reuses the existing sealed snapshot; does not regenerate content.
   */
  async retry(
    deliveryMessageId: string,
    input: {
      operationId: string;
      expectedVersion: number;
      reason: string;
      actorUserId: string;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const message = await tx.deliveryMessage.findUnique({
        where: { id: deliveryMessageId },
        select: { companyId: true },
      });
      if (!message?.companyId) {
        throw new DomainConflictException(
          'DELIVERY_MESSAGE_NOT_FOUND',
          'Delivery message not found.',
        );
      }
      const proof = this.commandProof('retry', {
        deliveryMessageId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      });
      const existing = await tx.deliveryCommandReceipt.findFirst({
        where: { companyId: message.companyId, operationId: input.operationId },
      });
      if (existing) {
        if (
          existing.deliveryMessageId !== deliveryMessageId ||
          existing.commandType !== 'retry' ||
          existing.requestHash !== proof.hash ||
          existing.requestHashKeyVersion !== proof.keyVersion ||
          existing.requestHashFormatVersion !== 1
        ) {
          throw new DomainConflictException(
            'OPERATION_ID_REUSED',
            'operationId was already used for a different delivery command.',
          );
        }
        return;
      }

      const updated = await tx.deliveryMessage.updateMany({
        where: {
          id: deliveryMessageId,
          version: input.expectedVersion,
          status: {
            in: [
              DeliveryMessageStatus.DEAD_LETTER,
              DeliveryMessageStatus.FAILED,
              DeliveryMessageStatus.RETRY_WAIT,
              DeliveryMessageStatus.BOUNCED_SOFT,
            ],
          },
          provider: {
            in: [DeliveryProvider.ZEPTOMAIL, DeliveryProvider.SMTP],
          },
        },
        data: {
          status: DeliveryMessageStatus.RETRY_WAIT,
          nextAttemptAt: new Date(),
          lastErrorCode: null,
          lastErrorClass: null,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new DomainConflictException(
          'DELIVERY_STATE_CHANGED',
          'Delivery message version or status changed.',
        );
      }

      await tx.deliveryCommandReceipt.create({
        data: {
          operationId: input.operationId,
          command: 'retry',
          commandType: 'retry',
          companyId: message.companyId,
          deliveryMessageId,
          actorUserId: input.actorUserId,
          actorId: input.actorUserId,
          requestHash: proof.hash,
          requestHashKeyVersion: proof.keyVersion,
          requestHashFormatVersion: 1,
          responseSnapshot: { deliveryMessageId, status: 'RETRY_WAIT' },
        },
      });
    });
  }

  async cancel(
    deliveryMessageId: string,
    input: {
      operationId: string;
      expectedVersion: number;
      reason: string;
      actorUserId: string;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const message = await tx.deliveryMessage.findUnique({
        where: { id: deliveryMessageId },
        select: { companyId: true },
      });
      if (!message?.companyId) {
        throw new DomainConflictException(
          'DELIVERY_MESSAGE_NOT_FOUND',
          'Delivery message not found.',
        );
      }
      const proof = this.commandProof('cancel', {
        deliveryMessageId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      });
      const existing = await tx.deliveryCommandReceipt.findFirst({
        where: { companyId: message.companyId, operationId: input.operationId },
      });
      if (existing) {
        if (
          existing.deliveryMessageId !== deliveryMessageId ||
          existing.commandType !== 'cancel' ||
          existing.requestHash !== proof.hash ||
          existing.requestHashKeyVersion !== proof.keyVersion ||
          existing.requestHashFormatVersion !== 1
        ) {
          throw new DomainConflictException(
            'OPERATION_ID_REUSED',
            'operationId was already used for a different delivery command.',
          );
        }
        return;
      }

      const updated = await tx.deliveryMessage.updateMany({
        where: {
          id: deliveryMessageId,
          version: input.expectedVersion,
          status: {
            in: [
              DeliveryMessageStatus.QUEUED,
              DeliveryMessageStatus.RETRY_WAIT,
              DeliveryMessageStatus.FAILED,
            ],
          },
        },
        data: {
          status: DeliveryMessageStatus.CANCELLED,
          terminalAt: new Date(),
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new DomainConflictException(
          'DELIVERY_STATE_CHANGED',
          'Delivery message version or status changed.',
        );
      }

      await tx.deliveryCommandReceipt.create({
        data: {
          operationId: input.operationId,
          command: 'cancel',
          commandType: 'cancel',
          companyId: message.companyId,
          deliveryMessageId,
          actorUserId: input.actorUserId,
          actorId: input.actorUserId,
          requestHash: proof.hash,
          requestHashKeyVersion: proof.keyVersion,
          requestHashFormatVersion: 1,
          responseSnapshot: { deliveryMessageId, status: 'CANCELLED' },
        },
      });
    });
  }

  private commandProof(
    commandType: 'retry' | 'cancel',
    input: {
      deliveryMessageId: string;
      expectedVersion: number;
      reason: string;
    },
  ): { hash: string; keyVersion: string } {
    const keyVersion = this.configService.getOrThrow(
      'DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION',
      { infer: true },
    );
    const key = this.configService.getOrThrow(
      'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS',
      { infer: true },
    )[keyVersion];
    if (!key)
      throw new Error(`DELIVERY_COMMAND_RECEIPT_KEY_MISSING:${keyVersion}`);
    const canonical = JSON.stringify({
      commandType,
      deliveryMessageId: input.deliveryMessageId,
      expectedVersion: input.expectedVersion,
      reason: input.reason.trim(),
    });
    return {
      hash: createHmac('sha256', key).update(canonical, 'utf8').digest('hex'),
      keyVersion,
    };
  }
}
