import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';

import { notificationCopy } from './notification-event.catalog';
import { resolveNotificationHref } from './notification-href';

type PrismaTx = Prisma.TransactionClient;

export interface CreateUserNotificationInput {
  userId: string;
  companyGroupId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  eventCode: string;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey: string;
  title?: string;
  message?: string;
  expiresAt?: Date | null;
}

@Injectable()
export class UserNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateUserNotificationInput,
    tx?: PrismaTx,
  ): Promise<{ id: string; created: boolean }> {
    const client = tx ?? this.prisma;
    const copy = notificationCopy(input.eventCode);
    const title = input.title?.trim() || copy.title;
    const message = input.message?.trim() || copy.message;

    try {
      const row = await client.userNotification.create({
        data: {
          userId: input.userId,
          companyGroupId: input.companyGroupId ?? null,
          companyId: input.companyId ?? null,
          branchId: input.branchId ?? null,
          eventCode: input.eventCode,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          title,
          message,
          dedupeKey: input.dedupeKey,
          expiresAt: input.expiresAt ?? null,
        },
      });
      return { id: row.id, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await client.userNotification.findUnique({
          where: { dedupeKey: input.dedupeKey },
          select: { id: true },
        });
        return { id: existing?.id ?? input.dedupeKey, created: false };
      }
      throw error;
    }
  }

  async listForUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) {
    const rows = await this.findForUser(userId, options);
    return this.toListDto(rows);
  }

  async listForEmployee(
    employeeId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { employeeId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) {
      return [];
    }
    return this.findForUser(user.id, options);
  }

  private async findForUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const where: Prisma.UserNotificationWhereInput = {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    if (options?.unreadOnly) {
      where.readAt = null;
    }

    return this.prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markRead(id: string, actor: AuthenticatedUser) {
    const row = await this.prisma.userNotification.findFirst({
      where: { id, userId: actor.id },
    });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    if (row.readAt) {
      return row;
    }
    return this.prisma.userNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(actor: AuthenticatedUser) {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  toListDto(
    rows: Array<{
      id: string;
      title: string;
      message: string;
      eventCode: string;
      entityType: string | null;
      entityId: string | null;
      createdAt: Date;
      readAt: Date | null;
    }>,
  ) {
    return rows.map((row) => ({
      id: row.id,
      eventCode: row.eventCode,
      title: row.title,
      message: row.message,
      entityType: row.entityType,
      entityId: row.entityId,
      href: resolveNotificationHref(
        row.eventCode,
        row.entityType,
        row.entityId,
      ),
      readAt: row.readAt,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  toWorkspaceDto(
    rows: Array<{
      title: string;
      message: string;
      eventCode: string;
      entityType?: string | null;
      entityId?: string | null;
      createdAt: Date;
      readAt: Date | null;
    }>,
  ) {
    return rows.map((row) => {
      const copy = notificationCopy(row.eventCode);
      return {
        title: row.title,
        description: row.message,
        priority: copy.priority,
        time: row.createdAt.toISOString(),
        read: Boolean(row.readAt),
        href: resolveNotificationHref(
          row.eventCode,
          row.entityType,
          row.entityId,
        ),
      };
    });
  }
}
