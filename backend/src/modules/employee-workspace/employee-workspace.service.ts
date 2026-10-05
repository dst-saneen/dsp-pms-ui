import { Injectable } from '@nestjs/common';
import { ShiftRosterStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeWorkspaceResponseDto } from './dto/employee-workspace-response.dto';
import { EmployeeService } from '../employee/employee.service';
import { TaskWorkSessionService } from '../task-work-session/task-work-session.service';
import { WorkScheduleItemService } from '../work-schedule-item/work-schedule-item.service';
import { AttendanceService } from '../attendance/attendance.service';
import { BranchTimeService } from '../attendance/branch-time.service';
import { EmployeeLeaveService } from '../employee-leave/employee-leave.service';
import { toCalendarDate } from '../attendance/attendance-calendar.util';
import { EmployeeWorkspaceActivityService } from './services/employee-workspace-activity.service';
import { EmployeeWorkspaceNotificationService } from './services/employee-workspace-notification.service';

@Injectable()
export class EmployeeWorkspaceService {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly taskWorkSessionService: TaskWorkSessionService,
    private readonly workScheduleItemService: WorkScheduleItemService,
    private readonly attendanceService: AttendanceService,
    private readonly branchTime: BranchTimeService,
    private readonly employeeLeaveService: EmployeeLeaveService,
    private readonly activityService: EmployeeWorkspaceActivityService,
    private readonly notificationService: EmployeeWorkspaceNotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async getWorkspace(
    employeeId: string,
  ): Promise<EmployeeWorkspaceResponseDto> {
    const [
      employee,
      summary,
      currentTask,
      todaySchedule,
      recentActivities,
      notifications,
      todayShift,
    ] = await Promise.all([
      this.buildEmployee(employeeId),
      this.buildSummary(employeeId),
      this.buildCurrentTask(employeeId),
      this.buildTodaySchedule(employeeId),
      this.buildRecentActivities(employeeId),
      this.buildNotifications(employeeId),
      this.buildTodayShift(employeeId),
    ]);

    return {
      employee,
      summary,
      currentTask,
      todaySchedule,
      recentActivities,
      notifications,
      todayShift,
      todayWorkPlan: {
        itemCount: todaySchedule.length,
        items: todaySchedule.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          plannedStartTime: item.plannedStartTime
            ? String(item.plannedStartTime)
            : null,
          plannedEndTime: item.plannedEndTime
            ? String(item.plannedEndTime)
            : null,
        })),
      },
    };
  }

  private async buildEmployee(employeeId: string) {
    const employee = await this.employeeService.findOne(employeeId);
    return {
      id: employee.id,
      employeeNo: employee.employeeCode,
      fullName: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation?.designationName ?? '',
      department: employee.department?.departmentName ?? '',
      employmentStatus: employee.employmentStatus,
    };
  }

  private async buildSummary(employeeId: string) {
    const attendance =
      await this.attendanceService.getTodayAttendance(employeeId);
    const taskSummary =
      await this.workScheduleItemService.getEmployeeTaskSummary(employeeId);
    const leaveSummary = await this.employeeLeaveService.getSummary(employeeId);

    return {
      attendance: {
        status: attendance?.status ?? 'NOT_CHECKED_IN',
        checkIn: attendance?.checkInTime
          ? attendance.checkInTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
      },
      leave: {
        remaining: leaveSummary.totalBalance,
      },
      tasks: {
        assigned: taskSummary.assigned,
        dueToday: taskSummary.dueToday,
      },
      projects: {
        // Deferred until Project domain summary is available
        active: 0,
      },
    };
  }

  private async buildCurrentTask(employeeId: string) {
    return this.taskWorkSessionService.getCurrentTask(employeeId);
  }

  private async buildTodaySchedule(employeeId: string) {
    const items =
      await this.workScheduleItemService.getEmployeeTodayItems(employeeId);
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      priority: item.priority,
      status: item.status,
      plannedStartTime: item.plannedStartTime,
      plannedEndTime: item.plannedEndTime,
      plannedHours: item.plannedHours.toNumber(),
      task: item.task,
      workCategory: item.workCategory,
    }));
  }

  private async buildRecentActivities(employeeId: string) {
    return this.activityService.getRecentActivities(employeeId);
  }

  private async buildNotifications(employeeId: string) {
    return this.notificationService.getNotifications(employeeId);
  }

  private async buildTodayShift(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        branch: { select: { timezone: true } },
      },
    });
    const timezone = this.branchTime.requireTimezone(
      employee?.branch?.timezone,
    );
    const today = toCalendarDate(new Date(), timezone);
    const workDate = new Date(`${today}T00:00:00.000Z`);

    const entry = await this.prisma.shiftRosterEntry.findFirst({
      where: {
        employeeId,
        workDate,
        shiftRoster: {
          status: {
            in: [ShiftRosterStatus.PUBLISHED, ShiftRosterStatus.LOCKED],
          },
        },
      },
      include: {
        shift: { select: { shiftName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!entry) {
      return null;
    }

    return {
      workDate: entry.workDate.toISOString().slice(0, 10),
      dayType: entry.dayType,
      shiftName: entry.shift?.shiftName ?? null,
      scheduledStartAt: entry.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: entry.scheduledEndAt?.toISOString() ?? null,
      status: entry.dayType,
    };
  }
}
