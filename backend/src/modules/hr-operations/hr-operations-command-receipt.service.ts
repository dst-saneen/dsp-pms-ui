import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';

type DbClient = Prisma.TransactionClient;

/** A development-only key. Production commands fail closed without a real key. */
const DEV_FALLBACK_KEY = Buffer.from(
  'hr-operations-dev-idempotency-hmac-key-v1',
);

@Injectable()
export class HrOperationsCommandReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async execute<T>(input: {
    companyId: string;
    actorUserId: string;
    commandType: string;
    operationId: string;
    requestPayload: unknown;
    stateChangedCode?: string;
    execute: (
      tx: DbClient,
    ) => Promise<{ snapshot: Prisma.InputJsonValue; result: T }>;
  }): Promise<T> {
    const operationId = input.operationId.trim();
    if (!operationId) {
      throw new ConflictException({
        code: 'OPERATION_ID_REQUIRED',
        message: 'operationId is required',
      });
    }

    const proof = this.proof({ ...input, operationId });
    const existing = await this.prisma.hrCommandReceipt.findUnique({
      where: {
        companyId_operationId: { companyId: input.companyId, operationId },
      },
    });
    if (existing) {
      return this.replay<T>(existing, { ...input, operationId });
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.hrCommandReceipt.create({
              data: {
                companyId: input.companyId,
                operationId,
                commandType: input.commandType,
                requestDigest: proof.digest,
                requestHmacKeyVersion: proof.keyVersion,
                responseSnapshot: {},
                actorUserId: input.actorUserId,
              },
            });

            const executed = await input.execute(tx);
            await tx.hrCommandReceipt.update({
              where: {
                companyId_operationId: {
                  companyId: input.companyId,
                  operationId,
                },
              },
              data: { responseSnapshot: executed.snapshot },
            });
            // Return the persisted safe snapshot even on first execution. This
            // keeps first execution and idempotent replay byte-for-byte aligned.
            return executed.snapshot as T;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5_000,
            timeout: 15_000,
          },
        );
      } catch (error) {
        lastError = error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const raced = await this.prisma.hrCommandReceipt.findUnique({
            where: {
              companyId_operationId: {
                companyId: input.companyId,
                operationId,
              },
            },
          });
          if (raced) {
            return this.replay<T>(raced, { ...input, operationId });
          }
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < 2) continue;
          break;
        }
        throw error;
      }
    }
    if (
      lastError instanceof Prisma.PrismaClientKnownRequestError &&
      lastError.code === 'P2034'
    ) {
      throw new ConflictException({
        code: input.stateChangedCode ?? 'HR_OPERATIONS_STATE_CHANGED',
        message: 'Concurrent state changed; refresh and retry',
      });
    }
    throw lastError;
  }

  private replay<T>(
    receipt: {
      companyId: string;
      commandType: string;
      requestDigest: string;
      requestHmacKeyVersion: string;
      actorUserId: string | null;
      responseSnapshot: Prisma.JsonValue;
    },
    input: {
      companyId: string;
      commandType: string;
      actorUserId: string;
      operationId: string;
      requestPayload: unknown;
    },
  ): T {
    const proof = this.proof({
      ...input,
      keyVersion: receipt.requestHmacKeyVersion,
    });
    if (
      receipt.commandType !== input.commandType ||
      receipt.actorUserId !== input.actorUserId ||
      receipt.requestDigest !== proof.digest
    ) {
      throw new ConflictException({
        code: 'OPERATION_ID_REUSED',
        message: 'operationId was already used for a different command',
      });
    }
    return receipt.responseSnapshot as T;
  }

  private proof(input: {
    companyId: string;
    actorUserId: string;
    commandType: string;
    operationId: string;
    requestPayload: unknown;
    keyVersion?: string;
  }): { digest: string; keyVersion: string } {
    const canonical = this.stableStringify({
      format: 'hr-operations-command-v1',
      actorUserId: input.actorUserId,
      commandType: input.commandType,
      companyId: input.companyId,
      operationId: input.operationId,
      payload: input.requestPayload,
    });
    const keyVersion = input.keyVersion ?? this.activeKeyVersion();
    return {
      digest: createHmac('sha256', this.keyForVersion(keyVersion))
        .update(canonical)
        .digest('hex'),
      keyVersion,
    };
  }

  private activeKeyVersion(): string {
    return (
      this.config.get('HR_OPERATIONS_IDEMPOTENCY_HMAC_ACTIVE_VERSION', {
        infer: true,
      }) ?? 'v1'
    );
  }

  private keyForVersion(version: string): Buffer {
    const key = this.config.get('HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS', {
      infer: true,
    })?.[version];
    if (key) return key;

    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new ConflictException({
        code: 'HR_OPERATIONS_COMMAND_HMAC_UNAVAILABLE',
        message:
          'HR Operations command HMAC key is unavailable. Configure HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON.',
      });
    }
    return DEV_FALLBACK_KEY;
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }
}
