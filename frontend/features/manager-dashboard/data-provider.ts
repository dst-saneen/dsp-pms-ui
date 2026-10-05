import axios from "axios";

import { API_ENDPOINTS } from "@/config/api";
import {
  apiClient,
  getApiErrorCode,
  getApiErrorMessage,
  unwrapApiData,
} from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import type { PagedResult } from "@/features/onboarding/types/onboarding.types";
import type { EmployeeOnboardingTaskRuntimeView } from "@/features/onboarding/types/onboarding.types";
import { PROJECTS_ROUTES } from "@/features/projects/constants/permissions";
import type {
  Paginated,
  Timesheet,
} from "@/features/projects/types/project.types";

import type {
  DashboardAttendanceTone,
  DashboardTask,
  DashboardTimesheetApproval,
  DashboardWidgetMeta,
  DashboardWidgetSection,
  ManagerDashboardData,
  ManagerDashboardLiveResponse,
  ManagerDashboardPayload,
} from "./types";
import {
  DASHBOARD_KPI_HREFS,
  DASHBOARD_LEAVE_QUEUE_HREF,
  DASHBOARD_TIMESHEET_QUEUE_HREF,
} from "./types";

function attendanceTone(status: string): DashboardAttendanceTone {
  switch (status) {
    case "PRESENT":
      return "present";
    case "ABSENT":
      return "absent";
    case "LEAVE":
      return "leave";
    case "HALF_DAY":
      return "half-day";
    default:
      return "present";
  }
}

function emptySection<T>(): DashboardWidgetSection<T> {
  return { status: "empty", items: [], message: undefined, retryable: false };
}

function okSection<T>(items: T[]): DashboardWidgetSection<T> {
  if (items.length === 0) {
    return emptySection();
  }
  return { status: "ok", items, retryable: false };
}

function classifyWidgetError(error: unknown): DashboardWidgetMeta {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const code = (getApiErrorCode(error) ?? "").toUpperCase();

    if (status === 403 || code.includes("FORBIDDEN") || code.includes("PERMISSION")) {
      return {
        status: "not_authorized",
        message: getApiErrorMessage(
          error,
          "You are not authorized to view this widget.",
        ),
        retryable: false,
      };
    }

    if (
      status === 404 ||
      code.includes("NOT_ENABLED") ||
      code.includes("CAPABILITY") ||
      code.includes("FEATURE") ||
      code.includes("MODULE")
    ) {
      return {
        status: "not_enabled",
        message: getApiErrorMessage(
          error,
          "This module is not enabled for your organization.",
        ),
        retryable: false,
      };
    }
  }

  return {
    status: "error",
    message: getApiErrorMessage(error, "Could not load this widget."),
    retryable: true,
  };
}

function errorSection<T>(error: unknown): DashboardWidgetSection<T> {
  const meta = classifyWidgetError(error);
  return { ...meta, items: [] };
}

async function getActorScopedOnboardingTasks(): Promise<
  DashboardWidgetSection<DashboardTask>
> {
  try {
    const response = await apiClient.get<
      ApiResponse<PagedResult<EmployeeOnboardingTaskRuntimeView>>
    >(API_ENDPOINTS.onboarding.myTasks, {
      params: {
        page: 1,
        limit: 5,
        sortBy: "dueDate",
        sortOrder: "ASC",
        status: "PENDING",
      },
    });

    const page = unwrapApiData(response.data);
    const items = (page?.items ?? []).map((task) => ({
      id: task.id,
      title: task.taskName,
      assignee: task.employee.displayName,
      status: task.status.toLowerCase().replaceAll("_", "-"),
      dueDate: task.dueDate,
      href: `/my-workspace/onboarding?taskId=${task.id}`,
    }));

    return okSection(items);
  } catch (error) {
    return errorSection<DashboardTask>(error);
  }
}

async function getPendingTimesheetApprovals(): Promise<
  DashboardWidgetSection<DashboardTimesheetApproval>
> {
  try {
    const response = await apiClient.get<ApiResponse<Paginated<Timesheet>>>(
      API_ENDPOINTS.projects.teamTimesheets,
      {
        params: {
          page: 1,
          limit: 5,
          status: "SUBMITTED",
        },
      },
    );
    const page = unwrapApiData(response.data);
    const items = (page?.items ?? []).map((sheet) => ({
      id: sheet.id,
      employeeId: sheet.employeeId,
      periodStart: sheet.periodStart,
      periodEnd: sheet.periodEnd,
      totalHours: sheet.totalHours,
      status: sheet.status,
      href: `${PROJECTS_ROUTES.teamTimesheets}?status=SUBMITTED`,
    }));
    return okSection(items);
  } catch (error) {
    return errorSection<DashboardTimesheetApproval>(error);
  }
}

function mapLiveCore(live: ManagerDashboardLiveResponse): Pick<
  ManagerDashboardData,
  | "manager"
  | "visibility"
  | "timezone"
  | "asOf"
  | "metrics"
  | "metricsWidget"
  | "pendingLeaveApprovals"
  | "attendance"
  | "recentJoiners"
  | "interviews"
> {
  const leaveItems = (live.pendingLeaveApprovals ?? []).map((item) => ({
    ...item,
    href: DASHBOARD_LEAVE_QUEUE_HREF,
  }));

  return {
    manager: live.manager,
    visibility: live.visibility,
    timezone: live.timezone,
    asOf: live.asOf,
    metricsWidget: { status: "ok", retryable: false },
    metrics: [
      {
        key: "total-employees",
        label: "Total Employees",
        value: live.kpis.totalActiveEmployees,
        tone: "coral",
        href: DASHBOARD_KPI_HREFS["total-employees"],
      },
      {
        key: "present-today",
        label: "Present Today",
        value: live.kpis.presentToday,
        tone: "teal",
        href: DASHBOARD_KPI_HREFS["present-today"],
      },
      {
        key: "on-leave",
        label: "On Leave Today",
        value: live.kpis.onLeaveToday,
        tone: "amber",
        href: DASHBOARD_KPI_HREFS["on-leave"],
      },
      {
        key: "active-onboardings",
        label: "Active Onboardings",
        value: live.kpis.activeOnboardings,
        tone: "sky",
        href: DASHBOARD_KPI_HREFS["active-onboardings"],
      },
    ],
    interviews: [],
    pendingLeaveApprovals: okSection(leaveItems),
    attendance: okSection(
      (live.attendanceOverview ?? []).map((item) => ({
        label: item.label,
        percentage: item.percentage,
        count: item.count,
        tone: attendanceTone(item.status),
      })),
    ),
    recentJoiners: okSection(
      (live.recentJoiners ?? []).map((joiner) => ({
        id: joiner.id,
        name: joiner.name,
        designation: joiner.designation,
        joiningDate: joiner.joiningDate,
        href: `/hr/employees`,
      })),
    ),
  };
}

function failedCore(message: string): Pick<
  ManagerDashboardData,
  | "manager"
  | "visibility"
  | "metrics"
  | "metricsWidget"
  | "pendingLeaveApprovals"
  | "attendance"
  | "recentJoiners"
  | "interviews"
> {
  return {
    manager: { fullName: "Manager", role: "Manager" },
    visibility: {
      employeeSummary: false,
      attendance: false,
      leave: false,
      onboarding: false,
    },
    metricsWidget: {
      status: "error",
      message,
      retryable: true,
    },
    metrics: [],
    interviews: [],
    pendingLeaveApprovals: {
      status: "error",
      message,
      retryable: true,
      items: [],
    },
    attendance: {
      status: "error",
      message,
      retryable: true,
      items: [],
    },
    recentJoiners: {
      status: "error",
      message,
      retryable: true,
      items: [],
    },
  };
}

export async function getManagerDashboardData(): Promise<ManagerDashboardPayload> {
  const [coreResult, tasks, pendingTimesheetApprovals] = await Promise.all([
    apiClient
      .get<ApiResponse<ManagerDashboardLiveResponse>>("/dashboard/manager")
      .then((response) => {
        const live = unwrapApiData(response.data);
        if (!live?.kpis) {
          throw new Error("Dashboard response was missing KPI data.");
        }
        return { ok: true as const, live };
      })
      .catch((error: unknown) => ({ ok: false as const, error })),
    getActorScopedOnboardingTasks(),
    getPendingTimesheetApprovals(),
  ]);

  if (!coreResult.ok) {
    const message = getApiErrorMessage(
      coreResult.error,
      "Failed to load dashboard",
    );
    return {
      source: "live",
      data: {
        ...failedCore(message),
        tasks,
        pendingTimesheetApprovals,
      },
      error: { message },
    };
  }

  return {
    source: "live",
    data: {
      ...mapLiveCore(coreResult.live),
      tasks,
      pendingTimesheetApprovals,
    },
  };
}

/** Keep demo mapper compatible if still imported elsewhere. */
export function mapLiveDashboard(
  live: ManagerDashboardLiveResponse,
  actorScopedTasks: DashboardTask[],
  pendingTimesheetApprovals: DashboardTimesheetApproval[] = [],
): ManagerDashboardData {
  return {
    ...mapLiveCore(live),
    tasks: okSection(actorScopedTasks),
    pendingTimesheetApprovals: okSection(
      pendingTimesheetApprovals.map((item) => ({
        ...item,
        href: item.href.includes("?")
          ? item.href
          : DASHBOARD_TIMESHEET_QUEUE_HREF,
      })),
    ),
  };
}
