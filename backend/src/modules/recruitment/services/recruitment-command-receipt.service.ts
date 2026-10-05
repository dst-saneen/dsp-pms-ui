import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import { DomainConflictException, getRequestActor } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class RecruitmentCommandReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  hashRequest(input: {
    companyId: string;
    commandType: string;
    jobApplicationId: string;
    expectedVersion: number;
    operationId: string;
    reasonCode?: string;
    comment?: string;
  }): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          companyId: input.companyId,
          commandType: input.commandType,
          jobApplicationId: input.jobApplicationId,
          expectedVersion: input.expectedVersion,
          operationId: input.operationId,
          reasonCode: input.reasonCode ?? null,
          comment: input.comment ?? null,
        }),
      )
      .digest('hex');
  }

  async claimOrReplay<T>(input: {
    companyId: string;
    commandType: string;
    jobApplicationId: string;
    expectedVersion: number;
    operationId: string;
    reasonCode?: string;
    comment?: string;
    execute: (tx: DbClient) => Promise<{
      snapshot: Prisma.InputJsonValue;
      result: T;
    }>;
  }): Promise<T> {
    const actor = getRequestActor();
    if (!actor.userId) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPERATION_ID_REUSED,
        'Authenticated actor is required for recruitment commands.',
      );
    }

    const requestHash = this.hashRequest({
      companyId: input.companyId,
      commandType: input.commandType,
      jobApplicationId: input.jobApplicationId,
      expectedVersion: input.expectedVersion,
      operationId: input.operationId,
      reasonCode: input.reasonCode,
      comment: input.comment,
    });

    const existing = await this.prisma.recruitmentCommandReceipt.findUnique({
      where: {
        companyId_operationId: {
          companyId: input.companyId,
          operationId: input.operationId,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.OPERATION_ID_REUSED,
          'operationId was already used with a different request.',
        );
      }
      if (existing.safeResultSnapshot == null) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.OPERATION_ID_REUSED,
          'operationId is still in progress. Retry shortly.',
        );
      }
      return existing.safeResultSnapshot as T;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.recruitmentCommandReceipt.create({
          data: {
            companyId: input.companyId,
            operationId: input.operationId,
            actorUserId: actor.userId!,
            commandType: input.commandType,
            requestHash,
            jobApplicationId: input.jobApplicationId,
          },
        });

        const executed = await input.execute(tx);

        await tx.recruitmentCommandReceipt.update({
          where: {
            companyId_operationId: {
              companyId: input.companyId,
              operationId: input.operationId,
            },
          },
          data: { safeResultSnapshot: executed.snapshot },
        });

        return executed.result;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.recruitmentCommandReceipt.findUnique({
          where: {
            companyId_operationId: {
              companyId: input.companyId,
              operationId: input.operationId,
            },
          },
        });
        if (raced?.requestHash === requestHash) {
          return raced.safeResultSnapshot as T;
        }
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.OPERATION_ID_REUSED,
          'operationId was already used with a different request.',
        );
      }
      throw error;
    }
  }
}
