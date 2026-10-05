import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';

import { Environment } from '../../config';
import { DomainConflictException, prismaMetaTargetText } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';

import type { AssetAccessContext } from './asset-access.types';
import { AssetFeatureGateService } from './asset-feature-gate.service';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

type DbClient = Prisma.TransactionClient;

const REQUEST_HASH_FORMAT_VERSION = 1;
const DEV_FALLBACK_KEY = Buffer.from(
  'asset-idempotency-dev-key-v1-32b!!!!',
  'utf8',
).subarray(0, 32);

@Injectable()
export class AssetIdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly featureGate: AssetFeatureGateService,
  ) {}

  async execute<T>(
    context: AssetAccessContext,
    companyId: string,
    commandType: string,
    requestPayload: unknown,
    run: (tx: DbClient) => Promise<{
      entityType: string;
      entityId: string;
      snapshot: Prisma.InputJsonValue;
    }>,
    replay: (entityId: string) => Promise<T>,
  ): Promise<T> {
    await this.featureGate.assertEnabledForCompany(companyId);

    const operationId = (
      requestPayload as { operationId?: string }
    )?.operationId?.trim();
    if (!operationId) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.VALIDATION_ERROR,
        'operationId is required',
      );
    }
    const activeVersion = this.activeKeyVersion();
    const requestHash = this.hashRequest(
      companyId,
      context.userId,
      commandType,
      requestPayload,
      activeVersion,
    );
    const existing = await this.prisma.assetCommandReceipt.findUnique({
      where: {
        companyId_operationId: { companyId, operationId },
      },
    });

    if (existing) {
      return this.replayReceipt(
        existing,
        context,
        companyId,
        commandType,
        requestPayload,
        replay,
      );
    }

    try {
      const committed = await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.assetCommandReceipt.create({
          data: {
            companyId,
            operationId,
            actorUserId: context.userId,
            commandType,
            requestHash,
            requestHashKeyVersion: activeVersion,
            requestHashFormatVersion: REQUEST_HASH_FORMAT_VERSION,
          },
        });

        const executed = await run(tx);

        await tx.assetCommandReceipt.update({
          where: { id: receipt.id },
          data: {
            resultEntityType: executed.entityType,
            resultEntityId: executed.entityId,
            safeResultSnapshot: executed.snapshot,
          },
        });

        return executed;
      });

      const fullResponse = await replay(committed.entityId);
      await this.prisma.assetCommandReceipt.update({
        where: {
          companyId_operationId: { companyId, operationId },
        },
        data: {
          safeResultSnapshot: fullResponse as Prisma.InputJsonValue,
        },
      });
      return fullResponse;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const targetText = prismaMetaTargetText(error.meta?.target);
        if (targetText.includes('operationId')) {
          const raced = await this.prisma.assetCommandReceipt.findUnique({
            where: {
              companyId_operationId: { companyId, operationId },
            },
          });
          if (raced) {
            return this.replayReceipt(
              raced,
              context,
              companyId,
              commandType,
              requestPayload,
              replay,
            );
          }
        }
      }

      throw error;
    }
  }

  commandMeta(entityType: string, entityId: string) {
    return {
      entityType,
      entityId,
      snapshot: {
        id: entityId,
        type: entityType,
      } satisfies Prisma.InputJsonValue,
    };
  }

  hashRequest(
    companyId: string,
    actorUserId: string,
    commandType: string,
    payload: unknown,
    keyVersion?: string,
  ): string {
    const version = keyVersion ?? this.activeKeyVersion();
    const key = this.keyForVersion(version);
    const canonical = this.canonicalString(
      REQUEST_HASH_FORMAT_VERSION,
      companyId,
      actorUserId,
      commandType,
      payload,
    );
    return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
  }

  private async replayReceipt<T>(
    receipt: {
      actorUserId: string;
      requestHash: string;
      requestHashKeyVersion?: string | null;
      resultEntityId: string | null;
      safeResultSnapshot?: Prisma.JsonValue | null;
    },
    context: AssetAccessContext,
    companyId: string,
    commandType: string,
    requestPayload: unknown,
    replay: (entityId: string) => Promise<T>,
  ): Promise<T> {
    const replayHash = this.hashRequest(
      companyId,
      context.userId,
      commandType,
      requestPayload,
      receipt.requestHashKeyVersion || this.activeKeyVersion(),
    );

    if (
      receipt.actorUserId !== context.userId ||
      receipt.requestHash !== replayHash
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        'Idempotency key was reused with a different request',
      );
    }

    if (!receipt.resultEntityId) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        'Idempotency key was reused with a different request',
      );
    }

    if (this.isFullSnapshot(receipt.safeResultSnapshot)) {
      return receipt.safeResultSnapshot as T;
    }

    return replay(receipt.resultEntityId);
  }

  private isFullSnapshot(
    snapshot: Prisma.JsonValue | null | undefined,
  ): boolean {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return false;
    }

    const keys = Object.keys(snapshot);
    return !(keys.length <= 2 && 'id' in snapshot && 'type' in snapshot);
  }

  private canonicalString(
    formatVersion: number,
    companyId: string,
    actorUserId: string,
    commandType: string,
    payload: unknown,
  ): string {
    return this.stableStringify({
      formatVersion,
      companyId: companyId.trim().toLowerCase(),
      actorUserId: actorUserId.trim().toLowerCase(),
      commandType,
      payload,
    });
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'string') {
        const uuid = value.trim().toLowerCase();
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value.trim(),
          )
        ) {
          return JSON.stringify(uuid);
        }
      }
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined);
    return `{${keys
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }

  private activeKeyVersion(): string {
    return (
      this.configService.get('ASSET_IDEMPOTENCY_HMAC_ACTIVE_VERSION', {
        infer: true,
      }) ?? 'v1'
    );
  }

  private keyForVersion(version: string): Buffer {
    const keys =
      this.configService.get('ASSET_IDEMPOTENCY_HMAC_KEYS', {
        infer: true,
      }) ?? {};
    const configured = keys[version];
    if (configured) {
      return configured;
    }

    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    if (nodeEnv === 'production') {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_SENSITIVE_STORAGE_UNAVAILABLE,
        'Asset idempotency HMAC key is unavailable',
      );
    }

    return DEV_FALLBACK_KEY;
  }
}
