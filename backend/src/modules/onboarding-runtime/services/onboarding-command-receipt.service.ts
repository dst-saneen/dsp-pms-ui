import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DomainConflictException } from '../../../common';
import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';

import type {
  OnboardingCommandReceiptClaimInput,
  OnboardingCommandReceiptClaimResult,
} from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';

const REQUEST_HASH_FORMAT_VERSION = 1;

interface StoredReceiptRow {
  id: string;
  actorUserId: string;
  commandType: string;
  requestHash: string;
  requestHashKeyVersion: string;
  resultEntityType: string | null;
  resultEntityId: string | null;
  safeResultSnapshot: unknown;
  completedAt: Date | null;
}

type ReceiptDb = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OnboardingCommandReceiptService {
  private readonly hashSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
  ) {
    const secretPath = resolve(
      process.cwd(),
      this.configService.getOrThrow('AUTH_ACTION_TOKEN_SECRET_PATH', {
        infer: true,
      }),
    );

    if (!existsSync(secretPath)) {
      throw new Error(
        'AUTH_ACTION_TOKEN_SECRET_PATH must point to a readable local file.',
      );
    }

    this.hashSecret = readFileSync(secretPath, 'utf8');
  }

  getActiveKeyVersion(): string {
    return this.configService.get('ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION', {
      infer: true,
    });
  }

  computeRequestHash(
    payload: Record<string, unknown>,
    keyVersion: string,
  ): string {
    const canonical = this.canonicalize(payload);
    return createHmac('sha256', `${this.hashSecret}:${keyVersion}`)
      .update(canonical, 'utf8')
      .digest('hex')
      .toLowerCase();
  }

  async claimOrReplay(
    input: OnboardingCommandReceiptClaimInput,
    keyVersion: string,
    db: ReceiptDb = this.prisma,
  ): Promise<OnboardingCommandReceiptClaimResult> {
    const requestHash = this.computeRequestHash(
      input.requestPayload,
      keyVersion,
    );

    const existing = await this.findReceipt(
      db,
      input.companyId,
      input.operationId,
    );

    if (existing) {
      if (
        existing.actorUserId !== input.actorUserId ||
        existing.commandType !== input.commandType
      ) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.OPERATION_ID_REUSED,
          'operationId was already used by another actor or command.',
        );
      }

      const replayHash = this.computeRequestHash(
        input.requestPayload,
        existing.requestHashKeyVersion,
      );
      if (existing.requestHash !== replayHash) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.OPERATION_ID_REUSED,
          'operationId was already used with a different command payload.',
        );
      }

      if (!existing.completedAt) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
          'A previous command with this operationId did not complete.',
        );
      }

      return {
        claimed: false,
        isReplay: true,
        receiptId: existing.id,
        safeResultSnapshot: this.asSnapshot(existing.safeResultSnapshot),
        resultEntityType: existing.resultEntityType ?? undefined,
        resultEntityId: existing.resultEntityId ?? undefined,
      };
    }

    const inserted = await this.tryInsertReceipt(db, {
      companyId: input.companyId,
      operationId: input.operationId,
      commandType: input.commandType,
      actorUserId: input.actorUserId,
      requestHash,
      requestHashKeyVersion: keyVersion,
    });

    if (inserted) {
      return {
        claimed: true,
        isReplay: false,
        receiptId: inserted.id,
      };
    }

    return this.claimOrReplay(input, keyVersion, db);
  }

  async completeReceipt(
    receiptId: string,
    result: {
      resultEntityType: string;
      resultEntityId: string;
      safeResultSnapshot: Record<string, unknown>;
    },
    db: ReceiptDb = this.prisma,
  ): Promise<void> {
    await db.$executeRaw`
      UPDATE "OnboardingCommandReceipt"
      SET
        "resultEntityType" = ${result.resultEntityType},
        "resultEntityId" = ${result.resultEntityId},
        "safeResultSnapshot" = ${JSON.stringify(result.safeResultSnapshot)}::jsonb,
        "completedAt" = NOW()
      WHERE id = ${receiptId}
    `;
  }

  private async findReceipt(
    db: ReceiptDb,
    companyId: string,
    operationId: string,
  ): Promise<StoredReceiptRow | null> {
    const rows = await db.$queryRaw<StoredReceiptRow[]>`
      SELECT
        id,
        "actorUserId",
        "commandType"::text AS "commandType",
        "requestHash",
        "requestHashKeyVersion",
        "resultEntityType",
        "resultEntityId",
        "safeResultSnapshot",
        "completedAt"
      FROM "OnboardingCommandReceipt"
      WHERE "companyId" = ${companyId}
        AND "operationId" = ${operationId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  private async tryInsertReceipt(
    db: ReceiptDb,
    input: {
      companyId: string;
      operationId: string;
      commandType: string;
      actorUserId: string;
      requestHash: string;
      requestHashKeyVersion: string;
    },
  ): Promise<{ id: string } | null> {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "OnboardingCommandReceipt" (
        id,
        "companyId",
        "operationId",
        "commandType",
        "actorUserId",
        "requestHash",
        "requestHashKeyVersion",
        "requestHashFormatVersion",
        "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        ${input.companyId},
        ${input.operationId},
        ${input.commandType}::"OnboardingCommandType",
        ${input.actorUserId},
        ${input.requestHash},
        ${input.requestHashKeyVersion},
        ${REQUEST_HASH_FORMAT_VERSION},
        NOW()
      )
      ON CONFLICT ("companyId", "operationId") DO NOTHING
      RETURNING id
    `;

    return rows[0] ?? null;
  }

  private canonicalize(value: unknown): string {
    return JSON.stringify(this.normalize(value));
  }

  private normalize(value: unknown): unknown {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || typeof value !== 'object') {
      if (typeof value === 'string') {
        return value.trim();
      }

      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.normalize(entry));
    }

    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      const next = this.normalize(record[key]);
      if (next !== undefined) {
        normalized[key] = next;
      }
    }

    return normalized;
  }

  private asSnapshot(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}
