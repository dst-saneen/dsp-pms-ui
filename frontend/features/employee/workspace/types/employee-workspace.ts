

export interface EmployeeSummary {
  id: string;
  employeeNo: string;
  fullName: string;
  designation: string;
  department: string;
  employmentStatus: string;
}

export interface WorkspaceAttendanceSummary {
  status: string;
  checkIn: string;
}

export interface WorkspaceLeaveSummary {
  remaining: number;
}

export interface WorkspaceTaskSummary {
  assigned: number;
  dueToday: number;
}

export interface WorkspaceProjectSummary {
  active: number;
}

export interface WorkspaceSummary {
  attendance: WorkspaceAttendanceSummary;
  leave: WorkspaceLeaveSummary;
  tasks: WorkspaceTaskSummary;
  projects: WorkspaceProjectSummary;
}

export interface WorkspaceNamedRef {
  id?: string;
  name?: string;
  code?: string;
  title?: string;
  projectName?: string;
  stageName?: string;
  startedAt?: string;
}

export interface WorkspaceCurrentTask {
  workScheduleItemId: string;
  title: string;
  description: string | null;
  priority: string;
  plannedHours: number;
  status: string;
  project: WorkspaceNamedRef | null;
  stage: WorkspaceNamedRef | null;
  task: WorkspaceNamedRef | null;
  runtime: WorkspaceNamedRef | null;
}

export interface WorkspaceScheduleItem {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  plannedHours: number;
  task: WorkspaceNamedRef | null;
  workCategory: WorkspaceNamedRef | null;
}

export interface WorkspaceActivity {
  title: string;
  description: string;
  time: string;
}

export interface WorkspaceNotification {
  title: string;
  description: string;
  priority: string;
  time: string;
  href?: string | null;
  read?: boolean;
}

export interface EmployeeWorkspace {
  employee: EmployeeSummary;
  summary: WorkspaceSummary;
  currentTask: WorkspaceCurrentTask | null;
  todaySchedule: WorkspaceScheduleItem[];
  recentActivities: WorkspaceActivity[];
  notifications: WorkspaceNotification[];
}