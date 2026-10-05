import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TaskStatus } from '@prisma/client';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';

import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';
import {
  OnboardingNotificationEventCode,
  OnboardingNotificationService,
} from './onboarding-notification.service';

const BATCH_SIZE = 200;
const MAX_BATCHES = 100;
const REMINDER_TASK_SELECT = {
  id: true,
  companyId: true,
  branchId: true,
  employeeId: true,
  onboardingId: true,
  assignedToUserId: true,
  dueDate: true,
  statusV2: true,
} satisfies Prisma.EmployeeOnboardingTaskSelect;

type ReminderTask = Prisma.EmployeeOnboardingTaskGetPayload<{
  select: typeof REMINDER_TASK_SELECT;
}>;

@Injectable()
export class OnboardingReminderJobService {
  private readonly logger = new Logger(OnboardingReminderJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureGate: OnboardingFeatureGateService,
    private readonly notification: OnboardingNotificationService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async runDueReminders(): Promise<{ scanned: number; queued: number }> {
    if (
      !(await this.featureGate.hasAnyEnabledCompany()) ||
      !this.configService.get('ONBOARDING_REMINDERS_ENABLED', { infer: true })
    ) {
      return { scanned: 0, queued: 0 };
    }

    const asOf = new Date();
    const dueSoonThreshold = new Date(asOf);
    dueSoonThreshold.setUTCDate(dueSoonThreshold.getUTCDate() + 2);

    let scanned = 0;
    let queued = 0;
    let cursorDueDate: Date | null = null;
    let cursorId: string | null = null;
    const businessDate = asOf.toISOString().slice(0, 10);

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const tasks = (await this.prisma.employeeOnboardingTask.findMany({
        where: {
          contractVersion: 'V2',
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          dueDate: { not: null },
          AND: [
            {
              OR: [
                { dueDate: { lt: asOf } },
                { dueDate: { lte: dueSoonThreshold, gte: asOf } },
              ],
            },
            ...(cursorDueDate && cursorId
              ? [
                  {
                    OR: [
                      { dueDate: { gt: cursorDueDate } },
                      {
                        AND: [
                          { dueDate: cursorDueDate },
                          { id: { gt: cursorId } },
                        ],
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: REMINDER_TASK_SELECT,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      })) as ReminderTask[];

      if (tasks.length === 0) {
        break;
      }

      scanned += tasks.length;
      const last = tasks[tasks.length - 1];
      cursorDueDate = last.dueDate;
      cursorId = last.id;

      for (const task of tasks) {
        if (
          !task.companyId ||
          !(await this.featureGate.isEnabledForContext(
            task.companyId,
            task.branchId ?? undefined,
          ))
        ) {
          continue;
        }

        const isOverdue = task.dueDate! < asOf;
        const eventCode: OnboardingNotificationEventCode = isOverdue
          ? 'ONBOARDING_TASK_OVERDUE'
          : 'ONBOARDING_TASK_DUE_SOON';

        if (!task.assignedToUserId) {
          continue;
        }

        const recipientUserId = task.assignedToUserId;
        const dedupeKey = this.notification.buildTaskActionDedupeKey(
          eventCode,
          task.id,
          businessDate,
          recipientUserId,
        );

        const result = await this.notification.enqueueInTransaction(
          this.prisma,
          {
            companyId: task.companyId,
            branchId: task.branchId,
            employeeId: task.employeeId,
            onboardingId: task.onboardingId,
            onboardingTaskId: task.id,
            recipientUserId,
            eventCode,
            status: task.statusV2 ?? 'PENDING',
            dueDate: task.dueDate?.toISOString() ?? null,
          },
          dedupeKey,
        );

        if (result.created) {
          queued += 1;
        }
      }

      if (tasks.length < BATCH_SIZE) {
        break;
      }
    }

    this.logger.log(
      `Onboarding reminder scan scanned=${scanned} queued=${queued}`,
    );

    return { scanned, queued };
  }
}
