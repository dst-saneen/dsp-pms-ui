import type { ManagerDashboardData } from "./types";
import {
  DASHBOARD_KPI_HREFS,
  DASHBOARD_LEAVE_QUEUE_HREF,
} from "./types";

function okItems<T>(items: T[]) {
  return items.length === 0
    ? { status: "empty" as const, items: [] as T[], retryable: false }
    : { status: "ok" as const, items, retryable: false };
}

export const managerDashboardDemoData: ManagerDashboardData = {
  manager: {
    fullName: "Virgil Varelino",
    role: "HR Manager",
  },
  visibility: {
    employeeSummary: true,
    attendance: true,
    leave: true,
    onboarding: true,
  },
  metricsWidget: { status: "ok", retryable: false },
  metrics: [
    {
      key: "total-employees",
      label: "Total Employees",
      value: 421,
      tone: "coral",
      href: DASHBOARD_KPI_HREFS["total-employees"],
    },
    {
      key: "present-today",
      label: "Present Today",
      value: 240,
      tone: "teal",
      href: DASHBOARD_KPI_HREFS["present-today"],
    },
    {
      key: "on-leave",
      label: "On Leave Today",
      value: 18,
      tone: "amber",
      href: DASHBOARD_KPI_HREFS["on-leave"],
    },
    {
      key: "active-onboardings",
      label: "Active Onboardings",
      value: 12,
      tone: "sky",
      href: DASHBOARD_KPI_HREFS["active-onboardings"],
    },
  ],
  tasks: okItems([
    {
      id: "task-1",
      title: "Complete Joining Formalities",
      assignee: "Amina Rahman",
      status: "overdue",
      dueDayOffset: 0,
      href: "/my-workspace/onboarding",
    },
  ]),
  interviews: [],
  pendingLeaveApprovals: okItems([
    {
      id: "leave-1",
      employeeName: "Liam Carter",
      leaveType: "Annual",
      fromDate: "2026-09-16",
      toDate: "2026-09-18",
      requestedDays: 3,
      status: "PENDING",
      href: DASHBOARD_LEAVE_QUEUE_HREF,
    },
  ]),
  pendingTimesheetApprovals: okItems([]),
  attendance: okItems([
    { label: "Present", percentage: 72, tone: "present" as const },
    { label: "Absent", percentage: 8, tone: "absent" as const },
    { label: "On Leave", percentage: 14, tone: "leave" as const },
    { label: "Half Day", percentage: 6, tone: "half-day" as const },
  ]),
  recentJoiners: okItems([
    {
      id: "joiner-1",
      name: "Liam Carter",
      designation: "UI/UX Designer",
      joinedDayOffset: -2,
      href: "/hr/employees",
    },
  ]),
};
