import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { EmployeeWorkspaceController } from './employee-workspace.controller';
import { EmployeeWorkspaceService } from './employee-workspace.service';

import { EmployeeModule } from '../employee/employee.module';
import { TaskWorkSessionModule } from '../task-work-session/task-work-session.module';
import { WorkScheduleItemModule } from '../work-schedule-item/work-schedule-item.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeeLeaveModule } from '../employee-leave';
import { NotificationModule } from '../notification/notification.module';

import { EmployeeWorkspaceActivityService } from './services/employee-workspace-activity.service';
import { EmployeeWorkspaceNotificationService } from './services/employee-workspace-notification.service';

@Module({
  imports: [
    PrismaModule,
    EmployeeModule,
    TaskWorkSessionModule,
    WorkScheduleItemModule,
    AttendanceModule,
    EmployeeLeaveModule,
    NotificationModule,
  ],

  controllers: [EmployeeWorkspaceController],

  providers: [
    EmployeeWorkspaceService,
    EmployeeWorkspaceActivityService,
    EmployeeWorkspaceNotificationService,
  ],

  exports: [EmployeeWorkspaceService],
})
export class EmployeeWorkspaceModule {}
