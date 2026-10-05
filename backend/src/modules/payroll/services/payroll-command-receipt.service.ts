import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';

import {
  DomainConflictException,
  prismaMetaTargetText,
  withSerializationRetry,
} from '../../../common';
import type { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';

import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';

type DbClient = Prisma.TransactionClient;

const REQUEST_HASH_FORMAT_VERSION = 1;

@Injectable()
export class PayrollCommandReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async execute<T>(
    context: PayrollAccessContext,
    companyId: string,
    commandType: string,
    requestPayload: unknown,
    run: (tx: DbClient) => Promise<{
      entityType: string;
      entityId: string;
      snapshot: Prisma.InputJsonValue;
    }>,
    replay: (entityId: string) => Promise<T>,
    transactionOptions?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T> {
    const operationId = (
      requestPayload as { operationId?: string }
    )?.operationId?.trim();

    if (!operationId) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
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

    const existing = await this.prisma.payrollCommandReceipt.findUnique({
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
      const committed = await withSerializationRetry(() =>
        this.prisma.$transaction(async (tx) => {
          const receipt = await tx.payrollCommandReceipt.create({
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

          await tx.payrollCommandReceipt.update({
            where: { id: receipt.id },
            data: {
              resultEntityType: executed.entityType,
              resultEntityId: executed.entityId,
              safeResultSnapshot: executed.snapshot,
              completedAt: new Date(),
            },
          });

          return executed;
        }, transactionOptions),
      );

      // Build full response after commit; do not persist full response on the receipt.
      return replay(committed.entityId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const targetText = prismaMetaTargetText(error.meta?.target);

        if (targetText.includes('operationId')) {
          const raced = await this.prisma.payrollCommandReceipt.findUnique({
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

  commandMeta(
    entityType: string,
    entityId: string,
    extras?: Record<string, unknown>,
  ) {
    return {
      entityType,
      entityId,
      snapshot: {
        id: entityId,
        type: entityType,
        ...(extras ?? {}),
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
    const canonical = this.stableStringify({
      formatVersion: REQUEST_HASH_FORMAT_VERSION,
      companyId: companyId.trim().toLowerCase(),
      actorUserId: actorUserId.trim().toLowerCase(),
      commandType,
      payload,
    });

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
    context: PayrollAccessContext,
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
        PAYROLL_ERROR_CODES.OPERATION_ID_REUSED,
        'operationId was already used with a different request.',
      );
    }

    if (!receipt.resultEntityId) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.OPERATION_ID_REUSED,
        'operationId is still in progress. Retry shortly.',
      );
    }

    // Always rebuild the full response via scoped query — never return a
    // historical full payload that may contain salary/payment data.
    return replay(receipt.resultEntityId);
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
      this.configService.get('PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION', {
        infer: true,
      }) ?? 'v1'
    );
  }

  private keyForVersion(version: string): Buffer {
    const keys =
      this.configService.get('PAYROLL_IDEMPOTENCY_HMAC_KEYS', {
        infer: true,
      }) ?? {};
    const configured = keys[version];

    if (configured) {
      return configured;
    }

    throw new DomainConflictException(
      PAYROLL_ERROR_CODES.VALIDATION_ERROR,
      'Payroll idempotency HMAC key is unavailable',
    );
  }
}
