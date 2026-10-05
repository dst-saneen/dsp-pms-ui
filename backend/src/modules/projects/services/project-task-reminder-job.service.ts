import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProjectTaskParticipantStatus,
  ProjectTaskStatus,
  UserStatus,
} from '@prisma/client';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PROJECT_NOTIFICATION_EVENT,
  ProjectNotificationService,
} from './project-notification.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectTimePolicyService } from './project-time-policy.service';

const DUE_SOON_DAYS = 2;
const PAGE_SIZE = 100;

@Injectable()
export class ProjectTaskReminderJobService {
  private readonly logger = new Logger(ProjectTaskReminderJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureGate: ProjectsFeatureGateService,
    private readonly notification: ProjectNotificationService,
    private readonly timePolicy: ProjectTimePolicyService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async runDueReminders(now = new Date()): Promise<{
    scanned: number;
    queued: number;
  }> {
    if (
      !(await this.featureGate.hasAnyEnabledCompany()) ||
      !this.configService.get('PROJECTS_REMINDERS_ENABLED', { infer: true })
    ) {
      return { scanned: 0, queued: 0 };
    }

    // Due dates are stored as date-only UTC values. The final due/overdue
    // decision below is made independently for each recipient's Branch date.
    const maximumCandidateDueDate = new Date(now);
    maximumCandidateDueDate.setUTCDate(
      maximumCandidateDueDate.getUTCDate() + DUE_SOON_DAYS + 1,
    );

    let scanned = 0;
    let queued = 0;
    let cursor: string | undefined;

    do {
      const tasks = await this.prisma.projectTask.findMany({
        where: {
          dueDate: { not: null, lte: maximumCandidateDueDate },
          statusV2: {
            in: [
              ProjectTaskStatus.ASSIGNED,
              ProjectTaskStatus.IN_PROGRESS,
              ProjectTaskStatus.WAITING_REVIEW,
            ],
          },
        },
        select: {
          id: true,
          companyId: true,
          projectId: true,
          dueDate: true,
          statusV2: true,
          project: { select: { branchId: true } },
          participants: {
            where: { statusV2: ProjectTaskParticipantStatus.ACTIVE },
            select: {
              employee: {
                select: {
                  id: true,
                  companyId: true,
                  branchId: true,
                  isActive: true,
                  branch: {
                    select: {
                      id: true,
                      companyId: true,
                      isActive: true,
                      timezone: true,
                    },
                  },
                  user: {
                    select: { id: true, status: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: PAGE_SIZE,
      });

      for (const task of tasks) {
        scanned += 1;
        if (!(await this.featureGate.isEnabledForContext(task.companyId))) {
          continue;
        }

        for (const participant of task.participants) {
          const employee = participant.employee;
          const user = employee.user;
          const branch = employee.branch;
          if (
            !employee.isActive ||
            !user ||
            user.status !== UserStatus.ACTIVE ||
            employee.companyId !== task.companyId ||
            !branch?.isActive ||
            branch.companyId !== task.companyId ||
            !branch.timezone ||
            (task.project.branchId !== null &&
              branch.id !== task.project.branchId)
          ) {
            continue;
          }

          let businessDate: Date;
          try {
            businessDate = this.timePolicy.businessDateAt(now, branch.timezone);
          } catch {
            // A malformed branch timezone must not make the worker emit a
            // reminder for an ambiguous business date.
            continue;
          }
          const dueDate = task.dueDate!;
          const dueSoonEnd = new Date(businessDate);
          dueSoonEnd.setUTCDate(dueSoonEnd.getUTCDate() + DUE_SOON_DAYS);
          const eventType =
            dueDate < businessDate
              ? PROJECT_NOTIFICATION_EVENT.TASK_OVERDUE
              : dueDate <= dueSoonEnd
                ? PROJECT_NOTIFICATION_EVENT.TASK_DUE_SOON
                : null;
          if (!eventType) {
            continue;
          }

          const businessDateKey = businessDate.toISOString().slice(0, 10);
          const result = await this.notification.enqueue(this.prisma, {
            eventType,
            aggregateType: 'PROJECT_TASK',
            aggregateId: task.id,
            companyId: task.companyId,
            branchId: branch.id,
            projectId: task.projectId,
            taskId: task.id,
            employeeId: employee.id,
            status: task.statusV2,
            dueDate,
            recipientUserIds: [user.id],
            dedupeKey: `${eventType}:${task.id}:${businessDateKey}:${user.id}`,
          });
          if (result?.created) {
            queued += 1;
          }
        }
      }

      cursor = tasks.at(-1)?.id;
      if (tasks.length < PAGE_SIZE) {
        cursor = undefined;
      }
    } while (cursor);

    this.logger.log(
      `Project task reminder scan scanned=${scanned} queued=${queued}`,
    );
    return { scanned, queued };
  }
}
