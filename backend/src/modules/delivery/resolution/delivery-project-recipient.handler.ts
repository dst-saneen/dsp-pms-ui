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
import type { RecipientResolutionResult } from './delivery-recipient.types';

const TASK_ASSIGNEE_EVENTS = new Set([
  'projects.task.assigned',
  'projects.task.reassigned',
  'projects.task.returned',
  'projects.task.completed',
  'projects.task.due_soon',
  'projects.task.overdue',
]);

@Injectable()
export class DeliveryProjectRecipientHandler {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    if (!event.companyId) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'TENANT_SNAPSHOT_INCOMPLETE',
            redactedDetail: 'Project event is missing its Company scope',
          },
        ],
      };
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const fromPayload = Array.isArray(payload.recipientUserIds)
      ? payload.recipientUserIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [];
    const single = typeof payload.userId === 'string' ? [payload.userId] : [];
    const userIds = [...new Set([...fromPayload, ...single])];

    if (userIds.length === 0) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'NO_RECIPIENTS',
            redactedDetail: 'Project event had no recipientUserIds',
          },
        ],
      };
    }

    const taskId = typeof payload.taskId === 'string' ? payload.taskId : null;
    if (TASK_ASSIGNEE_EVENTS.has(event.eventType) && !taskId) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'PROJECT_TASK_RECIPIENT_CONTEXT_MISSING',
            redactedDetail:
              'Task-recipient event is missing its task identifier',
          },
        ],
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        status: UserStatus.ACTIVE,
        employee: {
          is: {
            isActive: true,
            companyId: event.companyId,
            ...(event.branchId ? { branchId: event.branchId } : {}),
            ...(taskId && TASK_ASSIGNEE_EVENTS.has(event.eventType)
              ? {
                  taskParticipants: {
                    some: {
                      companyId: event.companyId,
                      taskId,
                      statusV2: 'ACTIVE',
                    },
                  },
                }
              : {}),
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        normalizedEmail: true,
        employee: { select: { id: true, companyId: true, branchId: true } },
      },
    });

    const channels =
      definition.assigneeChannels ??
      definition.employeeChannels ??
      ([DeliveryChannel.IN_APP] as DeliveryChannel[]);

    const emailUnavailable = { value: false };
    const recipients = users.flatMap((user) => {
      const email =
        normalizeDeliveryEmail(user.normalizedEmail) ??
        normalizeDeliveryEmail(user.email);
      const availableChannels = channels.filter(
        (channel) => channel !== DeliveryChannel.EMAIL || Boolean(email),
      );
      if (availableChannels.length === 0) {
        emailUnavailable.value = true;
        return [];
      }
      if (channels.includes(DeliveryChannel.EMAIL) && !email) {
        emailUnavailable.value = true;
      }

      return [
        {
          kind: DeliveryRecipientKind.USER,
          recipientId: user.id,
          channels: availableChannels,
          toAddress: email ?? undefined,
          displayName: user.displayName ?? undefined,
          subject: definition.subject,
          recipientUserId: user.id,
          recipientEmployeeId: user.employee?.id ?? undefined,
        },
      ];
    });
    const exceptions = [] as RecipientResolutionResult['exceptions'];
    if (users.length !== userIds.length) {
      exceptions.push({
        reasonCode: 'PROJECT_RECIPIENT_UNAVAILABLE',
        redactedDetail:
          'One or more Project recipients failed active Company/Branch revalidation',
      });
    }
    if (emailUnavailable.value) {
      exceptions.push({
        reasonCode: 'NO_SAFE_EMAIL',
        redactedDetail: 'Project recipient has no safe email address',
      });
    }

    return { recipients, exceptions };
  }
}
