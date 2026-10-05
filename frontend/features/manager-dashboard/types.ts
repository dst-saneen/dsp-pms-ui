export type DashboardMetricKey =
  | "total-employees"
  | "present-today"
  | "on-leave"
  | "active-onboardings"
  | "open-positions";

export type DashboardMetricTone = "coral" | "teal" | "amber" | "sky";

/** DASH-02 — per-widget honesty. `empty` only when a successful zero-result. */
export type DashboardWidgetStatus =
  | "ok"
  | "empty"
  | "not_enabled"
  | "not_authorized"
  | "error"
  | "hidden";

export interface DashboardWidgetMeta {
  status: DashboardWidgetStatus;
  message?: string;
  retryable?: boolean;
}

export interface DashboardWidgetSection<T> extends DashboardWidgetMeta {
  items: T[];
}

export interface DashboardWeeklyPoint {
  label: string;
  value: number;
}

export interface DashboardMetric {
  key: DashboardMetricKey;
  label: string;
  value: number;
  tone: DashboardMetricTone;
  /** DASH-01 — scoped queue for this KPI */
  href?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
    label: string;
  };
  weekly?: DashboardWeeklyPoint[];
}

export type DashboardTaskStatus = "overdue" | "todo" | "in-progress" | string;

export interface DashboardTask {
  id: string;
  title: string;
  assignee: string;
  status: DashboardTaskStatus;
  dueDayOffset?: number;
  dueDate?: string | null;
  href?: string;
}

export type DashboardInterviewTone = "coral" | "teal" | "amber" | "sky";

export interface DashboardInterview {
  id: string;
  dayOffset: number;
  timeRange: string;
  timezone: string;
  interviewer: string;
  tone: DashboardInterviewTone;
}

export interface DashboardLeaveApproval {
  id: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  requestedDays: number;
  status: string;
  href?: string;
}

export type DashboardAttendanceTone =
  | "present"
  | "absent"
  | "leave"
  | "half-day";

export interface DashboardAttendanceItem {
  label: string;
  percentage: number;
  tone: DashboardAttendanceTone;
  count?: number;
}

export interface DashboardRecentJoiner {
  id: string;
  name: string;
  designation: string;
  joinedDayOffset?: number;
  joiningDate?: string | null;
  href?: string;
}

export interface DashboardTimesheetApproval {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  totalHours: string;
  status: string;
  href: string;
}

export interface DashboardVisibility {
  employeeSummary: boolean;
  attendance: boolean;
  leave: boolean;
  onboarding: boolean;
}

export interface ManagerDashboardData {
  manager: {
    fullName: string;
    role: string;
  };
  metrics: DashboardMetric[];
  metricsWidget: DashboardWidgetMeta;
  tasks: DashboardWidgetSection<DashboardTask>;
  interviews: DashboardInterview[];
  pendingLeaveApprovals: DashboardWidgetSection<DashboardLeaveApproval>;
  pendingTimesheetApprovals: DashboardWidgetSection<DashboardTimesheetApproval>;
  attendance: DashboardWidgetSection<DashboardAttendanceItem>;
  recentJoiners: DashboardWidgetSection<DashboardRecentJoiner>;
  visibility: DashboardVisibility;
  timezone?: string;
  asOf?: string;
}

export interface ManagerDashboardLiveResponse {
  asOf: string;
  timezone: string;
  source: "live";
  context: {
    scopeLevel: string;
    isGlobal: boolean;
    activeCompanyGroupId?: string;
    activeCompanyId?: string;
    activeBranchId?: string;
  };
  manager: {
    fullName: string;
    role: string;
  };
  visibility: DashboardVisibility;
  kpis: {
    totalActiveEmployees: number;
    presentToday: number;
    onLeaveToday: number;
    activeOnboardings: number;
  };
  pendingOnboardingTasks: Array<{
    id: string;
    title: string;
    assignee: string;
    status: string;
    dueDate: string | null;
  }>;
  pendingLeaveApprovals: DashboardLeaveApproval[];
  attendanceOverview: Array<{
    label: string;
    status: string;
    count: number;
    percentage: number;
  }>;
  recentJoiners: Array<{
    id: string;
    name: string;
    designation: string;
    joiningDate: string | null;
  }>;
}

export interface ManagerDashboardPayload {
  source: "demo" | "live";
  data: ManagerDashboardData;
  error?: {
    message: string;
    code?: string;
  };
}

export const DASHBOARD_KPI_HREFS: Record<DashboardMetricKey, string> = {
  "total-employees": "/hr/employees",
  "present-today": "/hr/attendance",
  "on-leave": "/hr/leave/calendar",
  "active-onboardings": "/hr/employee-onboarding",
  "open-positions": "/hr/recruitment/openings",
};

export const DASHBOARD_LEAVE_QUEUE_HREF = "/hr/leave?status=PENDING";
export const DASHBOARD_TIMESHEET_QUEUE_HREF = "/team/timesheets?status=SUBMITTED";
export const DASHBOARD_ONBOARDING_QUEUE_HREF = "/my-workspace/onboarding";
