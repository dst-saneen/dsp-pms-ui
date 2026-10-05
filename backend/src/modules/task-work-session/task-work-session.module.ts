import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { WorkScheduleItemModule } from '../work-schedule-item/work-schedule-item.module';

import { TaskWorkSessionService } from './task-work-session.service';

/**
 * HTTP controller retired (PRJ-P0-03). Service retained only for
 * EmployeeWorkspace current-task projection until that migrates to /me/project-tasks.
 */
@Module({
  imports: [PrismaModule, WorkScheduleItemModule],
  providers: [TaskWorkSessionService],
  exports: [TaskWorkSessionService],
})
export class TaskWorkSessionModule {}
