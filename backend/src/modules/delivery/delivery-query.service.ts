import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryMessageStatus,
  DeliveryRecipientExceptionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export type DeliveryAllowedAction = 'RETRY' | 'CANCEL' | 'RELEASE_SUPPRESSION';

export interface DeliveryMessageFilters {
  status?: DeliveryMessageStatus;
  channel?: DeliveryChannel;
  eventType?: string;
  keyword?: string;
  companyId?: string;
  branchId?: string;
  /** Platform ops only — filter by company when global. */
  filterCompanyId?: string;
  filterBranchId?: string;
  recipientId?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'nextAttemptAt' | 'deliveredAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  canRetry?: boolean;
  canCancel?: boolean;
}

export interface DeliveryMessageResponse {
  id: string;
  version: number;
  outboxEventType: string;
  eventType: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
  dedupeKey: string;
  recipientKind: string;
  /** Redacted — never a raw user/recipient address. */
  recipientDisplay: string | null;
  channel: string;
  provider: string;
  status: string;
  companyId: string | null;
  branchId: string | null;
  companyName: string | null;
  branchName: string | null;
  attemptCount: number;
  queuedAt: Date;
  nextAttemptAt: Date;
  firstAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  acceptedAt: Date | null;
  deliveredAt: Date | null;
  terminalAt: Date | null;
  deadLetteredAt: Date | null;
  lastErrorCode: string | null;
  bypassReason: string | null;
  createdAt: Date;
  allowedActions: DeliveryAllowedAction[];
  actionRequirements: {
    expectedVersion: number;
    requiresReason: boolean;
  };
}

@Injectable()
export class DeliveryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listMessages(filters: DeliveryMessageFilters): Promise<{
    items: DeliveryMessageResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const where = this.buildWhere(filters);

    const [rows, total] = await Promise.all([
      this.prisma.deliveryMessage.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: this.messageSelect(),
      }),
      this.prisma.deliveryMessage.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.mapResponse(r, filters)),
      total,
      page,
      limit,
    };
  }

  async getMessage(
    id: string,
    scope: DeliveryMessageFilters = {},
  ): Promise<DeliveryMessageResponse | null> {
    const row = await this.prisma.deliveryMessage.findFirst({
      where: {
        id,
        ...this.buildWhere(scope),
      },
      select: this.messageSelect(),
    });
    return row ? this.mapResponse(row, scope) : null;
  }

  async getAttempts(deliveryMessageId: string) {
    return this.prisma.deliveryAttempt.findMany({
      where: { deliveryMessageId },
      orderBy: { attemptedAt: 'asc' },
      select: {
        id: true,
        attemptNo: true,
        outcome: true,
        providerRequestId: true,
        providerStatusCode: true,
        errorCode: true,
        attemptedAt: true,
        durationMs: true,
      },
    });
  }

  async listDeadLetters(filters: DeliveryMessageFilters) {
    return this.listMessages({
      ...filters,
      status: DeliveryMessageStatus.DEAD_LETTER,
    });
  }

  async listSuppressions(filters: {
    companyId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.EmailSuppressionWhereInput = {
      releasedAt: null,
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.emailSuppression.findMany({
        where,
        orderBy: { suppressedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          reason: true,
          suppressedAt: true,
          releasedAt: true,
          companyGroupId: true,
          version: true,
          createdAt: true,
        },
      }),
      this.prisma.emailSuppression.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        allowedActions: ['RELEASE_SUPPRESSION'] as DeliveryAllowedAction[],
        actionRequirements: {
          expectedVersion: row.version,
          requiresReason: true,
        },
      })),
      total,
      page,
      limit,
    };
  }

  async listRecipientExceptions(filters: {
    companyId?: string;
    branchId?: string;
    status?: DeliveryRecipientExceptionStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.DeliveryRecipientExceptionWhereInput = {
      status: filters.status ?? DeliveryRecipientExceptionStatus.OPEN,
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.deliveryRecipientException.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          outboxEventId: true,
          eventType: true,
          aggregateType: true,
          aggregateId: true,
          companyId: true,
          branchId: true,
          reasonCode: true,
          redactedDetail: true,
          status: true,
          version: true,
          resolvedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.deliveryRecipientException.count({ where }),
    ]);

    return { items: rows, total, page, limit };
  }

  async getHealth() {
    const [queue, openExceptions] = await Promise.all([
      this.prisma.deliveryMessage.groupBy({
        by: ['status', 'channel'],
        _count: { id: true },
      }),
      this.prisma.deliveryRecipientException.count({
        where: { status: DeliveryRecipientExceptionStatus.OPEN },
      }),
    ]);

    return {
      queue: queue.map((r) => ({
        status: r.status,
        channel: r.channel,
        count: r._count.id,
      })),
      openRecipientExceptions: openExceptions,
    };
  }

  computeAllowedActions(
    status: DeliveryMessageStatus,
    options?: { canRetry?: boolean; canCancel?: boolean },
  ): DeliveryAllowedAction[] {
    const actions: DeliveryAllowedAction[] = [];
    if (
      options?.canRetry !== false &&
      (status === DeliveryMessageStatus.DEAD_LETTER ||
        status === DeliveryMessageStatus.FAILED ||
        status === DeliveryMessageStatus.RETRY_WAIT ||
        status === DeliveryMessageStatus.RECONCILING)
    ) {
      actions.push('RETRY');
    }
    if (
      options?.canCancel === true &&
      (status === DeliveryMessageStatus.QUEUED ||
        status === DeliveryMessageStatus.RETRY_WAIT ||
        status === DeliveryMessageStatus.FAILED)
    ) {
      actions.push('CANCEL');
    }
    return actions;
  }

  private buildWhere(
    filters: DeliveryMessageFilters,
  ): Prisma.DeliveryMessageWhereInput {
    const keyword = filters.keyword?.trim();
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.eventType
        ? {
            OR: [
              { eventType: filters.eventType },
              { outboxEventType: filters.eventType },
            ],
          }
        : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.filterCompanyId
        ? { companyId: filters.filterCompanyId }
        : {}),
      ...(filters.filterBranchId ? { branchId: filters.filterBranchId } : {}),
      ...(filters.recipientId ? { recipientId: filters.recipientId } : {}),
      ...(filters.fromDate || filters.toDate
        ? {
            createdAt: {
              ...(filters.fromDate ? { gte: filters.fromDate } : {}),
              ...(filters.toDate ? { lte: filters.toDate } : {}),
            },
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { id: { contains: keyword, mode: 'insensitive' } },
              { clientReference: { contains: keyword, mode: 'insensitive' } },
              { dedupeKey: { contains: keyword, mode: 'insensitive' } },
              { aggregateId: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private messageSelect() {
    return {
      id: true,
      version: true,
      outboxEventType: true,
      eventType: true,
      aggregateType: true,
      aggregateId: true,
      dedupeKey: true,
      recipientKind: true,
      channel: true,
      provider: true,
      status: true,
      companyId: true,
      branchId: true,
      attemptCount: true,
      queuedAt: true,
      nextAttemptAt: true,
      firstAttemptAt: true,
      lastAttemptAt: true,
      acceptedAt: true,
      deliveredAt: true,
      terminalAt: true,
      deadLetteredAt: true,
      toDisplayName: true,
      lastErrorCode: true,
      bypassReason: true,
      createdAt: true,
      company: { select: { companyName: true } },
      branch: { select: { branchName: true } },
    } as const;
  }

  private mapResponse(
    row: Prisma.DeliveryMessageGetPayload<{
      select: ReturnType<DeliveryQueryService['messageSelect']>;
    }>,
    filters: DeliveryMessageFilters,
  ): DeliveryMessageResponse {
    const allowedActions = this.computeAllowedActions(row.status, {
      canRetry: filters.canRetry,
      canCancel: filters.canCancel,
    });

    return {
      id: row.id,
      version: row.version,
      outboxEventType: row.outboxEventType,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      dedupeKey: row.dedupeKey,
      recipientKind: row.recipientKind,
      recipientDisplay: row.toDisplayName,
      channel: row.channel,
      provider: row.provider,
      status: row.status,
      companyId: row.companyId,
      branchId: row.branchId,
      companyName: row.company?.companyName ?? null,
      branchName: row.branch?.branchName ?? null,
      attemptCount: row.attemptCount,
      queuedAt: row.queuedAt,
      nextAttemptAt: row.nextAttemptAt,
      firstAttemptAt: row.firstAttemptAt,
      lastAttemptAt: row.lastAttemptAt,
      acceptedAt: row.acceptedAt,
      deliveredAt: row.deliveredAt,
      terminalAt: row.terminalAt,
      deadLetteredAt: row.deadLetteredAt,
      lastErrorCode: row.lastErrorCode,
      bypassReason: row.bypassReason,
      createdAt: row.createdAt,
      allowedActions,
      actionRequirements: {
        expectedVersion: row.version,
        requiresReason: allowedActions.length > 0,
      },
    };
  }
}
