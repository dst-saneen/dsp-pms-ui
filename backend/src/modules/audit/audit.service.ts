import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { getRequestActor, getRequestId } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditWriteOptions {
  userId?: string;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    entityName: string,
    entityId: string,
    action: string,
    oldValue?: unknown,
    newValue?: unknown,
    userIdOrOptions?: string | AuditWriteOptions,
  ) {
    const options: AuditWriteOptions =
      typeof userIdOrOptions === 'string'
        ? { userId: userIdOrOptions }
        : (userIdOrOptions ?? {});

    const actor = getRequestActor();
    const actorId = options.userId ?? actor.userId;
    const db = options.tx ?? this.prisma;

    return db.auditLog.create({
      data: {
        entityName,
        entityId,
        action,
        oldValue: oldValue as Prisma.InputJsonValue | undefined,
        newValue: newValue as Prisma.InputJsonValue | undefined,
        userId: actorId,
        requestId: getRequestId(),
        companyGroupId: actor.activeCompanyGroupId,
        companyId: actor.activeCompanyId,
        branchId: actor.activeBranchId,
      },
    });
  }
}
