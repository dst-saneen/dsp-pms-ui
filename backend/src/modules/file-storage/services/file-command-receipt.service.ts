import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaTx } from '../../outbox/outbox-writer.service';

@Injectable()
export class FileCommandReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async claimOrReplay<T>(
    client: PrismaTx | PrismaService,
    input: {
      companyId: string;
      operationId: string;
      commandType: string;
      requestDigest: string;
      actorUserId?: string | null;
      publicContext?: string | null;
    },
  ): Promise<{ replay: true; response: T } | { replay: false }> {
    const existing = await client.fileCommandReceipt.findUnique({
      where: {
        companyId_operationId: {
          companyId: input.companyId,
          operationId: input.operationId,
        },
      },
    });

    if (!existing) {
      return { replay: false };
    }

    if (
      existing.commandType !== input.commandType ||
      existing.requestDigest !== input.requestDigest
    ) {
      throw new ConflictException({ code: 'OPERATION_ID_REUSED' });
    }

    return { replay: true, response: existing.responseSnapshot as T };
  }

  async store(
    client: PrismaTx | PrismaService,
    input: {
      companyId: string;
      operationId: string;
      commandType: string;
      requestDigest: string;
      response: unknown;
      actorUserId?: string | null;
      publicContext?: string | null;
    },
  ): Promise<void> {
    await client.fileCommandReceipt.create({
      data: {
        companyId: input.companyId,
        operationId: input.operationId,
        commandType: input.commandType,
        requestDigest: input.requestDigest,
        responseSnapshot: input.response as Prisma.InputJsonValue,
        actorUserId: input.actorUserId ?? null,
        publicContext: input.publicContext ?? null,
        canonicalHashFormatVersion: 'v1',
      },
    });
  }
}
