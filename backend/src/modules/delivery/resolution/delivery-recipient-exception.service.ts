import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryRecipientExceptionStatus, OutboxEvent } from '@prisma/client';
import { createHmac } from 'node:crypto';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ResolutionExceptionInput } from './delivery-recipient.types';

@Injectable()
export class DeliveryRecipientExceptionService {
  private readonly logger = new Logger(DeliveryRecipientExceptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async record(
    event: OutboxEvent,
    exceptions: ResolutionExceptionInput[],
  ): Promise<void> {
    for (const exception of exceptions) {
      await this.prisma.deliveryRecipientException.upsert({
        where: {
          outboxEventId_reasonCode: {
            outboxEventId: event.id,
            reasonCode: exception.reasonCode,
          },
        },
        create: {
          outboxEventId: event.id,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          companyGroupId: event.companyGroupId,
          companyId: event.companyId,
          branchId: event.branchId,
          reasonCode: exception.reasonCode,
          redactedDetail: exception.redactedDetail?.slice(0, 256) ?? null,
          status: DeliveryRecipientExceptionStatus.OPEN,
        },
        update: {
          redactedDetail: exception.redactedDetail?.slice(0, 256) ?? null,
          status: DeliveryRecipientExceptionStatus.OPEN,
        },
      });

      this.logger.warn({
        event: 'delivery.recipient.resolution_exception',
        outboxEventId: event.id,
        eventType: event.eventType,
        reasonCode: exception.reasonCode,
      });
    }
  }

  async resolve(input: {
    id: string;
    companyId?: string;
    branchId?: string;
    expectedVersion: number;
    operationId: string;
    actorUserId: string;
    reason: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const exception = await tx.deliveryRecipientException.findFirst({
        where: {
          id: input.id,
          ...(input.companyId ? { companyId: input.companyId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
        },
        select: { id: true, companyId: true },
      });
      if (!exception?.companyId)
        throw new Error('RECIPIENT_EXCEPTION_NOT_FOUND');

      const proof = this.commandProof(input);
      const receipt = await tx.deliveryCommandReceipt.findFirst({
        where: {
          companyId: exception.companyId,
          operationId: input.operationId,
        },
      });
      if (receipt) {
        if (
          receipt.commandType !== 'resolve_recipient_exception' ||
          receipt.requestHash !== proof.hash ||
          receipt.requestHashKeyVersion !== proof.keyVersion ||
          receipt.requestHashFormatVersion !== 1
        )
          throw new Error('OPERATION_ID_REUSED');
        return;
      }

      const updated = await tx.deliveryRecipientException.updateMany({
        where: {
          id: exception.id,
          status: DeliveryRecipientExceptionStatus.OPEN,
          version: input.expectedVersion,
        },
        data: {
          status: DeliveryRecipientExceptionStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedByUserId: input.actorUserId,
          resolutionReason: input.reason.trim(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new Error('RECIPIENT_EXCEPTION_STATE_CHANGED');

      await tx.deliveryCommandReceipt.create({
        data: {
          companyId: exception.companyId,
          operationId: input.operationId,
          command: 'resolve_recipient_exception',
          commandType: 'resolve_recipient_exception',
          actorId: input.actorUserId,
          actorUserId: input.actorUserId,
          requestHash: proof.hash,
          requestHashKeyVersion: proof.keyVersion,
          requestHashFormatVersion: 1,
          responseSnapshot: {
            recipientExceptionId: exception.id,
            resolved: true,
          },
        },
      });
    });
  }

  private commandProof(input: {
    id: string;
    expectedVersion: number;
    reason: string;
  }): { hash: string; keyVersion: string } {
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
    return {
      hash: createHmac('sha256', key)
        .update(
          JSON.stringify({
            commandType: 'resolve_recipient_exception',
            id: input.id,
            expectedVersion: input.expectedVersion,
            reason: input.reason.trim(),
          }),
          'utf8',
        )
        .digest('hex'),
      keyVersion,
    };
  }
}
