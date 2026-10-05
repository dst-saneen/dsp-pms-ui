import { Injectable } from '@nestjs/common';

import {
  OutboxWriterService,
  type PrismaTx,
} from '../../outbox/outbox-writer.service';
import { PrismaService } from '../../../prisma/prisma.service';

export const PROJECT_NOTIFICATION_EVENT = {
  PROJECT_ACTIVATED: 'projects.project.activated',
  PROJECT_HELD: 'projects.project.held',
  PROJECT_RESUMED: 'projects.project.resumed',
  PROJECT_COMPLETED: 'projects.project.completed',
  PROJECT_CANCELLED: 'projects.project.cancelled',
  TEAM_MEMBER_ADDED: 'projects.team.member.added',
  TEAM_MEMBER_ENDED: 'projects.team.member.ended',
  TASK_ASSIGNED: 'projects.task.assigned',
  TASK_REASSIGNED: 'projects.task.reassigned',
  TASK_SUBMITTED: 'projects.task.submitted',
  TASK_RETURNED: 'projects.task.returned',
  TASK_COMPLETED: 'projects.task.completed',
  TASK_DUE_SOON: 'projects.task.due_soon',
  TASK_OVERDUE: 'projects.task.overdue',
  TIMESHEET_SUBMITTED: 'projects.timesheet.submitted',
  TIMESHEET_RETURNED: 'projects.timesheet.returned',
  TIMESHEET_APPROVED: 'projects.timesheet.approved',
  TIMESHEET_CANCELLED: 'projects.timesheet.cancelled',
} as const;

export type ProjectNotificationEvent =
  (typeof PROJECT_NOTIFICATION_EVENT)[keyof typeof PROJECT_NOTIFICATION_EVENT];

@Injectable()
export class ProjectNotificationService {
  constructor(
    private readonly outbox: OutboxWriterService,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(
    tx: PrismaTx,
    input: {
      eventType: ProjectNotificationEvent;
      aggregateType: string;
      aggregateId: string;
      companyId: string;
      branchId?: string | null;
      projectId?: string;
      taskId?: string;
      employeeId?: string;
      status?: string;
      version?: number;
      dueDate?: Date | string | null;
      recipientUserIds: string[];
      dedupeKey: string;
    },
  ): Promise<{ id: string; created: boolean } | null> {
    const recipients = [...new Set(input.recipientUserIds.filter(Boolean))];
    if (recipients.length === 0) {
      return null;
    }

    return this.outbox.write(tx, {
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      dedupeKey: input.dedupeKey,
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      payload: {
        eventCode: input.eventType,
        companyId: input.companyId,
        branchId: input.branchId ?? undefined,
        projectId: input.projectId,
        taskId: input.taskId,
        employeeId: input.employeeId,
        status: input.status,
        version: input.version,
        dueDate: input.dueDate ?? undefined,
        recipientUserIds: recipients,
      },
    });
  }

  async resolveManagerUserId(
    tx: PrismaTx,
    projectManagerEmployeeId: string | null | undefined,
  ): Promise<string | null> {
    if (!projectManagerEmployeeId) {
      return null;
    }
    const user = await tx.user.findFirst({
      where: { employeeId: projectManagerEmployeeId, status: 'ACTIVE' },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  async resolveEmployeeUserId(
    tx: PrismaTx,
    employeeId: string,
  ): Promise<string | null> {
    const user = await tx.user.findFirst({
      where: { employeeId, status: 'ACTIVE' },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /** Resolve PM user outside a command TX (read path helpers). */
  async resolveManagerUserIdOutsideTx(
    projectManagerEmployeeId: string | null | undefined,
  ): Promise<string | null> {
    return this.resolveManagerUserId(this.prisma, projectManagerEmployeeId);
  }
}
