import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { DomainConflictException, getRequestActor } from '../../../common';
import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import {
  replayProjectCommandReceipt,
  toProjectCommandReceiptSafeSnapshot,
} from '../policies/project-command-receipt-replay';
import {
  PROJECT_REQUEST_HASH_FORMAT_VERSION,
  buildProjectRequestCanonical,
  hmacProjectRequestHash,
} from '../policies/project-request-hash';

type DbClient = Prisma.TransactionClient;

/** Dev-only fallback when no HMAC key is configured (never production). */
const DEV_FALLBACK_KEY = Buffer.from(
  'project-lite-dev-idempotency-hmac-key-v1!!',
);

@Injectable()
export class ProjectCommandReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  hashRequest(input: {
    companyId: string;
    actorUserId: string;
    commandType: string;
    operationId: string;
    payload: unknown;
    keyVersion?: string;
  }): { hash: string; keyVersion: string } {
    const keyVersion = input.keyVersion ?? this.activeKeyVersion();
    const key = this.keyForVersion(keyVersion);
    const canonical = buildProjectRequestCanonical({
      formatVersion: PROJECT_REQUEST_HASH_FORMAT_VERSION,
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      commandType: input.commandType,
      operationId: input.operationId,
      payload: input.payload,
    });
    return {
      hash: hmacProjectRequestHash(key, canonical),
      keyVersion,
    };
  }

  async claimOrReplay<T>(input: {
    companyId: string;
    commandType: string;
    operationId: string;
    requestPayload: unknown;
    execute: (tx: DbClient) => Promise<{
      entityType: string;
      entityId: string;
      snapshot: Prisma.InputJsonValue;
      result: T;
    }>;
  }): Promise<T> {
    const actor = getRequestActor();
    if (!actor.userId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
        'Authenticated actor is required for project commands.',
      );
    }

    const { hash: requestHash, keyVersion } = this.hashRequest({
      companyId: input.companyId,
      actorUserId: actor.userId,
      commandType: input.commandType,
      operationId: input.operationId,
      payload: input.requestPayload,
    });

    const existing = await this.prisma.projectCommandReceipt.findUnique({
      where: {
        companyId_operationId: {
          companyId: input.companyId,
          operationId: input.operationId,
        },
      },
    });

    if (existing) {
      const replayHash = this.hashRequest({
        companyId: input.companyId,
        actorUserId: actor.userId,
        commandType: input.commandType,
        operationId: input.operationId,
        payload: input.requestPayload,
        keyVersion: existing.requestHashKeyVersion || keyVersion,
      }).hash;
      return replayProjectCommandReceipt<T>(
        { ...existing, requestHash: existing.requestHash },
        {
          requestHash: replayHash,
          commandType: input.commandType,
          actorUserId: actor.userId,
        },
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.projectCommandReceipt.create({
          data: {
            companyId: input.companyId,
            operationId: input.operationId,
            actorUserId: actor.userId!,
            commandType: input.commandType,
            requestHash,
            requestHashKeyVersion: keyVersion,
            requestHashFormatVersion: PROJECT_REQUEST_HASH_FORMAT_VERSION,
          },
        });

        const executed = await input.execute(tx);
        const safeResultSnapshot = toProjectCommandReceiptSafeSnapshot({
          entityId: executed.entityId,
          snapshot: executed.snapshot,
        });

        await tx.projectCommandReceipt.update({
          where: {
            companyId_operationId: {
              companyId: input.companyId,
              operationId: input.operationId,
            },
          },
          data: {
            resultEntityType: executed.entityType,
            resultEntityId: executed.entityId,
            safeResultSnapshot: safeResultSnapshot,
            completedAt: new Date(),
          },
        });

        return executed.result;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.projectCommandReceipt.findUnique({
          where: {
            companyId_operationId: {
              companyId: input.companyId,
              operationId: input.operationId,
            },
          },
        });
        if (raced) {
          const replayHash = this.hashRequest({
            companyId: input.companyId,
            actorUserId: actor.userId,
            commandType: input.commandType,
            operationId: input.operationId,
            payload: input.requestPayload,
            keyVersion: raced.requestHashKeyVersion || keyVersion,
          }).hash;
          return replayProjectCommandReceipt<T>(raced, {
            requestHash: replayHash,
            commandType: input.commandType,
            actorUserId: actor.userId,
          });
        }
        throw new DomainConflictException(
          PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
          'operationId was already used with a different request.',
        );
      }
      throw error;
    }
  }

  private activeKeyVersion(): string {
    return (
      this.configService.get('PROJECTS_IDEMPOTENCY_HMAC_ACTIVE_VERSION', {
        infer: true,
      }) ?? 'v1'
    );
  }

  private keyForVersion(version: string): Buffer {
    const keys =
      this.configService.get('PROJECTS_IDEMPOTENCY_HMAC_KEYS', {
        infer: true,
      }) ?? {};
    const configured = keys[version];
    if (configured) {
      return configured;
    }

    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    if (nodeEnv === 'production') {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.OPERATION_ID_REUSED,
        'Project command HMAC key version is unavailable. Configure PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON.',
      );
    }

    return DEV_FALLBACK_KEY;
  }
}
