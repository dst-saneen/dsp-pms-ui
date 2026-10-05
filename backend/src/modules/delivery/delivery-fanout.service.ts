import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryMessageStatus,
  DeliveryProvider,
  OutboxEvent,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { TransactionalMailService } from '../mail/transactional-mail.service';
import { DeliveryCryptoService } from './delivery-crypto.service';
import { DeliveryEmailContentService } from './delivery-email-content.service';
import { DeliveryRecipientExceptionService } from './resolution/delivery-recipient-exception.service';
import { DeliveryRecipientResolverService } from './resolution/delivery-recipient-resolver.service';
import type { ResolvedRecipient } from './resolution/delivery-recipient.types';

export { OFFER_SIGNATURE_EVENTS } from './resolution/delivery-event.registry';

/**
 * Creates one DeliveryMessage per (recipient × channel) after typed
 * recipient resolution. EMAIL rows seal an immutable content snapshot
 * at create time. Does not send.
 */
@Injectable()
export class DeliveryFanoutService {
  private readonly logger = new Logger(DeliveryFanoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: DeliveryRecipientResolverService,
    private readonly exceptions: DeliveryRecipientExceptionService,
    private readonly content: DeliveryEmailContentService,
    private readonly crypto: DeliveryCryptoService,
    private readonly mail: TransactionalMailService,
  ) {}

  async fanOut(event: OutboxEvent): Promise<void> {
    const { recipients, exceptions } = await this.resolver.resolve(event);

    if (exceptions.length > 0) {
      await this.exceptions.record(event, exceptions);
    }

    if (recipients.length === 0) {
      this.logger.warn({
        event: 'delivery.fanout.no_recipients',
        outboxEventId: event.id,
        eventType: event.eventType,
        exceptionCount: exceptions.length,
      });
      return;
    }

    for (const recipient of recipients) {
      for (const channel of recipient.channels) {
        await this.upsertMessage(event, recipient, channel);
      }
    }

    this.logger.log({
      event: 'delivery.fanout.complete',
      outboxEventId: event.id,
      eventType: event.eventType,
      recipientCount: recipients.length,
      exceptionCount: exceptions.length,
    });
  }

  private async upsertMessage(
    event: OutboxEvent,
    recipient: ResolvedRecipient,
    channel: DeliveryChannel,
  ): Promise<void> {
    const dedupeKey = `dm:${event.dedupeKey}:${recipient.kind}:${recipient.recipientId}:${channel}`;
    const recipientUserId =
      recipient.recipientUserId ??
      (channel === DeliveryChannel.IN_APP ? recipient.recipientId : undefined);

    const id = randomUUID();
    const base = {
      id,
      clientReference: id,
      companyGroupId: event.companyGroupId,
      companyId: event.companyId,
      branchId: event.branchId,
      outboxEventId: event.id,
      outboxEventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      dedupeKey,
      recipientKind: recipient.kind,
      recipientId: recipient.recipientId,
      recipientUserId,
      recipientEmployeeId: recipient.recipientEmployeeId,
      channel,
      provider:
        channel === DeliveryChannel.EMAIL
          ? this.mail.getDeliveryProvider()
          : DeliveryProvider.INTERNAL,
      status: DeliveryMessageStatus.QUEUED,
      nextAttemptAt: new Date(),
    };

    if (channel !== DeliveryChannel.EMAIL) {
      await this.prisma.deliveryMessage.upsert({
        where: { dedupeKey },
        create: {
          ...base,
          toAddress: recipient.toAddress,
          toDisplayName: recipient.displayName,
          subject: recipient.subject,
        },
        update: {},
      });
      return;
    }

    if (!recipient.toAddress) {
      await this.exceptions.record(event, [
        {
          reasonCode: 'NO_SAFE_EMAIL',
          redactedDetail: 'EMAIL channel recipient missing address at snapshot',
        },
      ]);
      return;
    }

    if (!this.crypto.isReady()) {
      await this.exceptions.record(event, [
        {
          reasonCode: 'CONTENT_ENCRYPTION_UNAVAILABLE',
          redactedDetail: 'Delivery content encryption keys are not ready',
        },
      ]);
      throw new Error('CONTENT_ENCRYPTION_UNAVAILABLE');
    }

    const snapshot = await this.content.renderSnapshot({ event, recipient });
    const encryptionContext = {
      messageId: id,
      companyId: event.companyId,
      channel: DeliveryChannel.EMAIL,
      templateKey: snapshot.templateKey,
      templateVersion: snapshot.templateVersion,
    };
    const sealedAddress = this.crypto.sealAddress(
      recipient.toAddress,
      encryptionContext,
    );
    const sealedContent = this.crypto.sealEmailContent(
      {
        subject: snapshot.subject,
        bodyText: snapshot.bodyText,
        bodyHtml: snapshot.bodyHtml,
      },
      encryptionContext,
    );

    await this.prisma.deliveryMessage.upsert({
      where: { dedupeKey },
      create: {
        ...base,
        // Delivery never writes address or subject plaintext.
        toAddress: null,
        toDisplayName: recipient.displayName,
        subject: null,
        templateKey: snapshot.templateKey,
        templateVersion: snapshot.templateVersion,
        recipientAddressCiphertext: sealedAddress.ciphertext,
        recipientAddressNonce: sealedAddress.nonce,
        recipientAddressAuthTag: sealedAddress.authTag,
        recipientAddressKeyVersion: sealedAddress.keyVersion,
        recipientAddressHmac: sealedAddress.addressHmac,
        recipientAddressHmacKeyVersion: sealedAddress.hmacKeyVersion,
        subjectCiphertext: sealedContent.subjectCiphertext,
        bodyTextCiphertext: sealedContent.bodyTextCiphertext,
        bodyHtmlCiphertext: sealedContent.bodyHtmlCiphertext,
        contentNonce: sealedContent.contentNonce,
        contentAuthTag: sealedContent.contentAuthTag,
        contentKeyVersion: sealedContent.contentKeyVersion,
      },
      update: {},
    });
  }
}
