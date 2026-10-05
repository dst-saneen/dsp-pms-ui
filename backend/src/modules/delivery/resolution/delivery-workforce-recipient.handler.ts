import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEvent,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { DeliveryEventDefinition } from './delivery-event.registry';
import { normalizeDeliveryEmail } from './delivery-email-normalize.util';
import { DeliveryHrRecipientService } from './delivery-hr-recipient.service';
import type {
  RecipientResolutionResult,
  ResolvedRecipient,
} from './delivery-recipient.types';
import { tenantSnapshotFromOutbox } from './delivery-recipient.types';

const BRANCH_ROSTER_EVENTS = new Set([
  'SHIFT_ROSTER_PUBLISHED',
  'SHIFT_ROSTER_LOCKED',
  'SHIFT_ROSTER_ARCHIVED',
]);
const RECIPIENT_PAGE_SIZE = 500;

type WorkforceUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  normalizedEmail: string | null;
  employee: { id: string } | null;
};

@Injectable()
export class DeliveryWorkforceRecipientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRecipients: DeliveryHrRecipientService,
  ) {}

  async resolve(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    if (!event.companyId) {
      return this.unsupported(
        'TENANT_SNAPSHOT_INCOMPLETE',
        'Workforce event is missing its Company scope',
      );
    }

    if (BRANCH_ROSTER_EVENTS.has(event.eventType)) {
      return this.resolveBranchRecipients(event, definition);
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const hasExplicitRecipientRule =
      'recipientUserIds' in payload || 'recipientUserId' in payload;
    const recipientUserIds = Array.isArray(payload.recipientUserIds)
      ? payload.recipientUserIds.filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    if (
      typeof payload.recipientUserId === 'string' &&
      payload.recipientUserId.trim()
    ) {
      recipientUserIds.push(payload.recipientUserId);
    }
    const uniqueUserIds = [...new Set(recipientUserIds)];
    const employeeId =
      typeof payload.employeeId === 'string' && payload.employeeId.trim()
        ? payload.employeeId
        : null;

    if (hasExplicitRecipientRule && uniqueUserIds.length === 0) {
      return this.unsupported(
        'NO_RECIPIENTS',
        'Workforce event has an explicit recipient rule but no valid user identifiers',
      );
    }
    if (!hasExplicitRecipientRule && !employeeId) {
      return this.unsupported(
        'UNSUPPORTED_EVENT',
        'Workforce event has no supported recipient identifier',
      );
    }

    const users = new Map<string, WorkforceUser>();
    if (uniqueUserIds.length > 0) {
      for (const user of await this.findDirectUsers(event, uniqueUserIds)) {
        users.set(user.id, user);
      }
    }
    if (!hasExplicitRecipientRule && employeeId) {
      for (const user of await this.findEmployeeUser(event, employeeId)) {
        users.set(user.id, user);
      }
    }

    const result = this.toRecipients([...users.values()], definition);
    const missingDirectRecipients = uniqueUserIds.some(
      (userId) => !users.has(userId),
    );
    const missingEmployeeRecipient =
      !hasExplicitRecipientRule &&
      Boolean(employeeId) &&
      ![...users.values()].some((user) => user.employee?.id === employeeId);

    if (missingDirectRecipients || missingEmployeeRecipient) {
      result.exceptions.unshift({
        reasonCode: 'WORKFORCE_RECIPIENT_UNAVAILABLE',
        redactedDetail:
          'One or more workforce recipients were inactive, missing, or outside the event tenant',
      });
    }
    if (result.recipients.length === 0 && result.exceptions.length === 0) {
      result.exceptions.push({
        reasonCode: 'NO_RECIPIENTS',
        redactedDetail:
          'No active workforce recipient matched the event tenant',
      });
    }

    return result;
  }

  private async resolveBranchRecipients(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    if (!event.branchId) {
      return this.unsupported(
        'TENANT_SNAPSHOT_INCOMPLETE',
        'Shift-roster notification is missing its Branch scope',
      );
    }

    const users: WorkforceUser[] = [];
    let cursorId: string | undefined;
    do {
      const page = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          employee: {
            is: {
              isActive: true,
              companyId: event.companyId as string,
              branchId: event.branchId,
            },
          },
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          normalizedEmail: true,
          employee: { select: { id: true } },
        },
        orderBy: { id: 'asc' },
        take: RECIPIENT_PAGE_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      users.push(...page);
      cursorId = page.at(-1)?.id;
      if (page.length < RECIPIENT_PAGE_SIZE) break;
    } while (cursorId);

    const result = this.toRecipients(users, definition);
    if (result.recipients.length === 0 && result.exceptions.length === 0) {
      result.exceptions.push({
        reasonCode: 'NO_RECIPIENTS',
        redactedDetail:
          'No active employee users matched the shift-roster branch',
      });
    }
    return result;
  }

  private async findDirectUsers(event: OutboxEvent, userIds: string[]) {
    const tenant = tenantSnapshotFromOutbox(event);
    const exactScopes =
      this.hrRecipients.buildExactScopeFilter(tenant, false) ?? [];
    const users: WorkforceUser[] = [];
    for (
      let offset = 0;
      offset < userIds.length;
      offset += RECIPIENT_PAGE_SIZE
    ) {
      const chunk = userIds.slice(offset, offset + RECIPIENT_PAGE_SIZE);
      users.push(
        ...(await this.prisma.user.findMany({
          where: {
            id: { in: chunk },
            status: UserStatus.ACTIVE,
            OR: [
              {
                employee: {
                  is: {
                    isActive: true,
                    companyId: event.companyId as string,
                    ...(event.branchId ? { branchId: event.branchId } : {}),
                  },
                },
              },
              ...(exactScopes.length > 0
                ? [
                    {
                      roleAssignments: {
                        some: { isActive: true, OR: exactScopes },
                      },
                    },
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            displayName: true,
            email: true,
            normalizedEmail: true,
            employee: { select: { id: true } },
          },
          orderBy: { id: 'asc' },
        })),
      );
    }
    return users;
  }

  private findEmployeeUser(event: OutboxEvent, employeeId: string) {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        employee: {
          is: {
            id: employeeId,
            isActive: true,
            companyId: event.companyId as string,
            ...(event.branchId ? { branchId: event.branchId } : {}),
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        normalizedEmail: true,
        employee: { select: { id: true } },
      },
      take: 2,
    });
  }

  private toRecipients(
    users: WorkforceUser[],
    definition: DeliveryEventDefinition,
  ): RecipientResolutionResult {
    const channels =
      definition.employeeChannels ??
      ([DeliveryChannel.IN_APP] as DeliveryChannel[]);
    const exceptions: RecipientResolutionResult['exceptions'] = [];
    const recipients: ResolvedRecipient[] = users.flatMap((user) => {
      const toAddress =
        normalizeDeliveryEmail(user.normalizedEmail) ??
        normalizeDeliveryEmail(user.email);
      const availableChannels = channels.filter(
        (channel) => channel !== DeliveryChannel.EMAIL || Boolean(toAddress),
      );
      if (
        channels.includes(DeliveryChannel.EMAIL) &&
        !toAddress &&
        availableChannels.length > 0
      ) {
        exceptions.push({
          reasonCode: 'NO_SAFE_EMAIL',
          redactedDetail:
            'Workforce recipient has no safe deliverable email address',
        });
      }
      if (availableChannels.length === 0) {
        return [];
      }
      return [
        {
          kind: DeliveryRecipientKind.USER,
          recipientId: user.id,
          recipientUserId: user.id,
          recipientEmployeeId: user.employee?.id,
          toAddress: toAddress ?? undefined,
          displayName: user.displayName ?? undefined,
          subject: definition.subject,
          channels: availableChannels,
        },
      ];
    });

    return { recipients, exceptions };
  }

  private unsupported(
    reasonCode: string,
    redactedDetail: string,
  ): RecipientResolutionResult {
    return {
      recipients: [],
      exceptions: [{ reasonCode, redactedDetail }],
    };
  }
}
