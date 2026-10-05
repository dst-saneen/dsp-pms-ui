import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Manages the `email_suppressions` table.
 *
 * Addresses are stored only as HMAC-SHA256(normalized address, a dedicated
 * versioned Delivery address key), scoped to a single Company. The webhook
 * signing secret is never an address-HMAC fallback.
 */
@Injectable()
export class DeliverySuppressionService {
  private readonly logger = new Logger(DeliverySuppressionService.name);
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}

  hmac(address: string): string {
    return createHmac('sha256', this.activeAddressHmacKey())
      .update(address.toLowerCase().trim())
      .digest('hex');
  }

  async isSuppressed(
    address: string,
    companyId: string | null | undefined,
  ): Promise<boolean> {
    const addressHmac = this.hmac(address);
    return this.isSuppressedHmac(addressHmac, companyId);
  }

  async isSuppressedHmac(
    addressHmac: string,
    companyId: string | null | undefined,
  ): Promise<boolean> {
    if (!companyId) return false;
    const row = await this.prisma.emailSuppression.findFirst({
      where: {
        addressHmac,
        releasedAt: null,
        companyId,
      },
      select: { id: true },
    });

    return row !== null;
  }

  async suppress(input: {
    address: string;
    companyId: string;
    reason: string;
    sourceEventId?: string;
  }): Promise<void> {
    const addressHmac = this.hmac(input.address);

    const existing = await this.prisma.emailSuppression.findFirst({
      where: {
        addressHmac,
        companyId: input.companyId,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.emailSuppression.update({
        where: { id: existing.id },
        data: {
          reason: input.reason,
          sourceEventId: input.sourceEventId,
          suppressedAt: new Date(),
          releasedAt: null,
          releasedBy: null,
        },
      });
    } else {
      await this.prisma.emailSuppression.create({
        data: {
          addressHmac,
          companyId: input.companyId,
          addressHmacKeyVersion: this.activeAddressHmacKeyVersion(),
          reason: input.reason,
          sourceEventId: input.sourceEventId,
          suppressedAt: new Date(),
        },
      });
    }

    this.logger.warn({
      event: 'delivery.suppression.created',
      reason: input.reason,
    });
  }

  async release(input: {
    suppressionId: string;
    companyId?: string;
    releasedBy: string;
    operationId: string;
    expectedVersion: number;
    reason: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const suppression = await tx.emailSuppression.findFirst({
        where: {
          id: input.suppressionId,
          ...(input.companyId ? { companyId: input.companyId } : {}),
        },
        select: { id: true, companyId: true, releasedAt: true },
      });
      if (!suppression?.companyId) {
        throw new Error('SUPPRESSION_NOT_FOUND');
      }
      const proof = this.commandProof({
        suppressionId: suppression.id,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      });

      const existing = await tx.deliveryCommandReceipt.findFirst({
        where: {
          companyId: suppression.companyId,
          operationId: input.operationId,
        },
      });
      if (existing) {
        if (
          existing.commandType !== 'release_suppression' ||
          existing.suppressionId !== suppression.id ||
          existing.requestHash !== proof.hash ||
          existing.requestHashKeyVersion !== proof.keyVersion ||
          existing.requestHashFormatVersion !== 1
        ) {
          throw new Error('OPERATION_ID_REUSED');
        }
        return;
      }

      const updated = await tx.emailSuppression.updateMany({
        where: {
          id: suppression.id,
          companyId: suppression.companyId,
          version: input.expectedVersion,
          releasedAt: null,
        },
        data: {
          releasedAt: new Date(),
          releasedBy: input.releasedBy,
          releasedByUserId: input.releasedBy,
          releaseReason: input.reason,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new Error('SUPPRESSION_STATE_CHANGED');
      }

      await tx.deliveryCommandReceipt.create({
        data: {
          operationId: input.operationId,
          companyId: suppression.companyId,
          command: 'release_suppression',
          commandType: 'release_suppression',
          suppressionId: input.suppressionId,
          actorId: input.releasedBy,
          actorUserId: input.releasedBy,
          requestHash: proof.hash,
          requestHashKeyVersion: proof.keyVersion,
          requestHashFormatVersion: 1,
          responseSnapshot: { suppressionId: suppression.id, released: true },
        },
      });
    });

    this.logger.log({
      event: 'delivery.suppression.released',
      suppressionId: input.suppressionId,
    });
  }

  private activeAddressHmacKeyVersion(): string {
    const version = this.configService.get(
      'DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION',
      { infer: true },
    );
    if (!version) {
      throw new Error('DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION_MISSING');
    }
    return version;
  }

  private activeAddressHmacKey(): Buffer {
    const version = this.activeAddressHmacKeyVersion();
    const key = this.configService.get('DELIVERY_ADDRESS_HMAC_KEYS', {
      infer: true,
    })[version];
    if (!key) {
      throw new Error(`DELIVERY_ADDRESS_HMAC_KEY_MISSING:${version}`);
    }
    return key;
  }

  private commandProof(input: {
    suppressionId: string;
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
            commandType: 'release_suppression',
            suppressionId: input.suppressionId,
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
