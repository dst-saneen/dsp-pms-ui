import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryAttemptOutcome, DeliveryMessageStatus } from '@prisma/client';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';

export interface DeliveryLeaseRecoveryResult {
  returnedToRetryWait: number;
  movedToReconciling: number;
}

/**
 * Recovers expired PROCESSING leases without blindly resending accepted mail.
 *
 * - If an ACCEPTED attempt already exists → RECONCILING (needs provider review)
 * - Otherwise → RETRY_WAIT with nextAttemptAt = now()
 */
@Injectable()
export class DeliveryLeaseRecoveryService {
  private readonly logger = new Logger(DeliveryLeaseRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async recoverExpiredLeases(
    limit?: number,
  ): Promise<DeliveryLeaseRecoveryResult> {
    const batchSize =
      limit ??
      this.configService.get('DELIVERY_WORKER_BATCH_SIZE', { infer: true });

    const expired = await this.prisma.deliveryMessage.findMany({
      where: {
        status: DeliveryMessageStatus.PROCESSING,
        lockExpiresAt: { lt: new Date() },
      },
      orderBy: { lockExpiresAt: 'asc' },
      take: batchSize,
      select: {
        id: true,
        attempts: {
          where: {
            outcome: {
              in: [
                DeliveryAttemptOutcome.ACCEPTED,
                DeliveryAttemptOutcome.DELIVERED,
              ],
            },
          },
          select: { id: true, providerRequestId: true },
          take: 1,
        },
      },
    });

    let returnedToRetryWait = 0;
    let movedToReconciling = 0;

    for (const message of expired) {
      const hasAcceptedEvidence = message.attempts.length > 0;
      if (hasAcceptedEvidence) {
        const updated = await this.prisma.deliveryMessage.updateMany({
          where: {
            id: message.id,
            status: DeliveryMessageStatus.PROCESSING,
            lockExpiresAt: { lt: new Date() },
          },
          data: {
            status: DeliveryMessageStatus.RECONCILING,
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            lastErrorCode: 'LEASE_EXPIRED_AFTER_ACCEPT',
            lastErrorClass: 'RECONCILE',
            version: { increment: 1 },
          },
        });
        movedToReconciling += updated.count;
        continue;
      }

      const updated = await this.prisma.deliveryMessage.updateMany({
        where: {
          id: message.id,
          status: DeliveryMessageStatus.PROCESSING,
          lockExpiresAt: { lt: new Date() },
        },
        data: {
          status: DeliveryMessageStatus.RETRY_WAIT,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          nextAttemptAt: new Date(),
          lastErrorCode: 'LEASE_EXPIRED',
          lastErrorClass: 'TRANSIENT',
          version: { increment: 1 },
        },
      });
      returnedToRetryWait += updated.count;
    }

    if (returnedToRetryWait > 0 || movedToReconciling > 0) {
      this.logger.warn({
        event: 'delivery.lease.recovered',
        returnedToRetryWait,
        movedToReconciling,
      });
    }

    return { returnedToRetryWait, movedToReconciling };
  }
}
