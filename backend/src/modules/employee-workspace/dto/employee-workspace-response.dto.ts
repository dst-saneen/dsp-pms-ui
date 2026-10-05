import { ApiProperty } from '@nestjs/swagger';

type WorkspaceReference = Record<string, unknown>;

export class EmployeeSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeNo: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  department: string;

  @ApiProperty()
  employmentStatus: string;
}

export class WorkspaceAttendanceSummaryDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  checkIn: string;
}

export class WorkspaceLeaveSummaryDto {
  @ApiProperty()
  remaining: number;
}

export class WorkspaceTaskSummaryDto {
  @ApiProperty()
  assigned: number;

  @ApiProperty()
  dueToday: number;
}

export class WorkspaceProjectSummaryDto {
  @ApiProperty()
  active: number;
}

export class WorkspaceSummaryDto {
  @ApiProperty({
    type: WorkspaceAttendanceSummaryDto,
  })
  attendance: WorkspaceAttendanceSummaryDto;

  @ApiProperty({
    type: WorkspaceLeaveSummaryDto,
  })
  leave: WorkspaceLeaveSummaryDto;

  @ApiProperty({
    type: WorkspaceTaskSummaryDto,
  })
  tasks: WorkspaceTaskSummaryDto;

  @ApiProperty({
    type: WorkspaceProjectSummaryDto,
  })
  projects: WorkspaceProjectSummaryDto;
}

export class WorkspaceCurrentTaskDto {
  @ApiProperty()
  workScheduleItemId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  plannedHours: number;

  @ApiProperty()
  status: string;

  @ApiProperty({
    nullable: true,
    example: {
      id: 'project-id',
      projectName: 'Airport Terminal Phase-2',
    },
  })
  project: WorkspaceReference | null;

  @ApiProperty({
    nullable: true,
    example: {
      id: 'stage-id',
      stageName: 'Architecture Documentation',
    },
  })
  stage: WorkspaceReference | null;

  @ApiProperty({
    nullable: true,
  })
  task: WorkspaceReference | null;

  @ApiProperty({
    nullable: true,
    example: {
      sessionId: 'session-id',
      startedAt: '2026-07-03T09:15:00.000Z',
      endedAt: null,
      status: 'IN_PROGRESS',
      confirmedHours: 2.5,
    },
  })
  runtime: WorkspaceReference | null;
}

export class WorkspaceScheduleItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  description: string | null;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  status: string;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  plannedStartTime: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  plannedEndTime: Date | null;

  @ApiProperty()
  plannedHours: number;

  @ApiProperty({
    nullable: true,
  })
  task: WorkspaceReference | null;

  @ApiProperty({
    nullable: true,
  })
  workCategory: WorkspaceReference | null;
}

export class WorkspaceActivityDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  time: string;
}

export class WorkspaceNotificationDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  time: string;

  @ApiProperty({ required: false })
  read?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Authorized in-app deep link when available',
  })
  href?: string | null;
}

export class EmployeeWorkspaceResponseDto {
  @ApiProperty({
    type: EmployeeSummaryDto,
  })
  employee: EmployeeSummaryDto;

  @ApiProperty({
    type: WorkspaceSummaryDto,
  })
  summary: WorkspaceSummaryDto;

  @ApiProperty({
    type: WorkspaceCurrentTaskDto,
  })
  currentTask: WorkspaceCurrentTaskDto | null;

  @ApiProperty({
    type: [WorkspaceScheduleItemDto],
  })
  todaySchedule: WorkspaceScheduleItemDto[];

  @ApiProperty({
    type: [WorkspaceActivityDto],
  })
  recentActivities: WorkspaceActivityDto[];

  @ApiProperty({
    type: [WorkspaceNotificationDto],
  })
  notifications: WorkspaceNotificationDto[];

  @ApiProperty({ required: false })
  todayShift?: {
    workDate: string | null;
    dayType: string | null;
    shiftName: string | null;
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    status: string | null;
  } | null;

  @ApiProperty({ required: false })
  todayWorkPlan?: {
    itemCount: number;
    items: Array<{
      id: string;
      title: string;
      status: string;
      plannedStartTime: string | null;
      plannedEndTime: string | null;
    }>;
  };
}
