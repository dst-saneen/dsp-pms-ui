import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';
import { WorkScheduleItemService } from '../work-schedule-item/work-schedule-item.service';

/**
 * HTTP mutations retired (PRJ-P0-03). Kept for EmployeeWorkspace current-task
 * projection only — time entry must use /me/timesheets.
 */
@Injectable()
export class TaskWorkSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workScheduleItemService: WorkScheduleItemService,
  ) {}

  startSession(): never {
    return rejectRetiredProjectsRoute();
  }

  endSession(): never {
    return rejectRetiredProjectsRoute();
  }

  async getCurrentTask(employeeId: string) {
    const currentItem =
      await this.workScheduleItemService.getCurrentEmployeeWorkItem(employeeId);

    if (!currentItem) {
      return null;
    }

    const activeSession = await this.prisma.taskWorkSession.findFirst({
      where: {
        employeeId,
        status: TaskStatus.IN_PROGRESS,
      },
      orderBy: { startedAt: 'desc' },
    });

    return {
      workScheduleItemId: currentItem.id,
      title: currentItem.title,
      description: currentItem.description,
      priority: currentItem.priority,
      plannedHours: Number(currentItem.plannedHours),
      status: currentItem.status,
      project: currentItem.task?.project ?? null,
      stage: currentItem.task?.stage ?? null,
      task: currentItem.task ?? null,
      runtime: activeSession
        ? {
            sessionId: activeSession.id,
            startedAt: activeSession.startedAt,
            endedAt: activeSession.endedAt,
            status: activeSession.status,
            confirmedHours: activeSession.confirmedHours,
          }
        : null,
    };
  }
}
