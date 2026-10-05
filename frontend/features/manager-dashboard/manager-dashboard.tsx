"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Plane,
  UserCheck,
  Users,
} from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

import { DashboardWidgetShell } from "./dashboard-widget-shell";
import type {
  DashboardAttendanceTone,
  DashboardMetric,
  DashboardMetricKey,
  DashboardMetricTone,
  DashboardTaskStatus,
  DashboardWidgetMeta,
  DashboardWidgetSection,
  ManagerDashboardPayload,
} from "./types";
import {
  DASHBOARD_LEAVE_QUEUE_HREF,
  DASHBOARD_ONBOARDING_QUEUE_HREF,
  DASHBOARD_TIMESHEET_QUEUE_HREF,
} from "./types";

const metricIcons: Record<DashboardMetricKey, LucideIcon> = {
  "total-employees": Users,
  "present-today": UserCheck,
  "on-leave": Plane,
  "active-onboardings": ClipboardCheck,
  "open-positions": BriefcaseBusiness,
};

const metricTones: Record<
  DashboardMetricTone,
  "accent" | "progress" | "warning" | "information"
> = {
  coral: "accent",
  teal: "progress",
  amber: "warning",
  sky: "information",
};

const attendanceToneClasses: Record<
  DashboardAttendanceTone,
  { dot: string; bar: string }
> = {
  present: {
    dot: "bg-brand-secondary-soft text-brand-secondary-strong",
    bar: "bg-brand-secondary",
  },
  absent: {
    dot: "bg-danger-soft text-destructive",
    bar: "bg-danger-accent",
  },
  leave: {
    dot: "bg-information-soft text-information-foreground",
    bar: "bg-information",
  },
  "half-day": {
    dot: "bg-warning-soft text-warning",
    bar: "bg-warning-accent",
  },
};

const taskStatus: Record<
  DashboardTaskStatus,
  { label: string; tone: "danger" | "neutral" | "progress" }
> = {
  overdue: { label: "Overdue", tone: "danger" },
  todo: { label: "To Do", tone: "neutral" },
  "in-progress": { label: "In Progress", tone: "progress" },
};

const avatarClasses = [
  "bg-brand-soft text-primary",
  "bg-brand-secondary-soft text-brand-secondary-strong",
  "bg-information-soft text-information-foreground",
  "bg-warning-soft text-warning",
  "bg-success-soft text-success",
];

function addDays(date: Date, offset: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + offset);
  return result;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function withVisibility(
  section: DashboardWidgetSection<unknown>,
  visible: boolean,
): DashboardWidgetMeta {
  if (!visible) {
    return { status: "hidden", retryable: false };
  }
  return section;
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const card = (
    <KpiCard
      title={metric.label}
      value={metric.value}
      icon={metricIcons[metric.key]}
      tone={metricTones[metric.tone]}
      trend={
        metric.trend
          ? {
              value: `${metric.trend.value}%`,
              direction: metric.trend.direction,
              label: metric.trend.label,
            }
          : undefined
      }
      series={metric.weekly}
      className="h-full transition hover:ring-primary/20 hover:ring-2"
    />
  );

  if (!metric.href) {
    return card;
  }

  return (
    <Link
      href={metric.href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`${metric.label}: ${metric.value}. Open related queue.`}
    >
      {card}
    </Link>
  );
}

function UpcomingTasks({
  section,
  now,
  onRetry,
  visible,
}: {
  section: ManagerDashboardPayload["data"]["tasks"];
  now: Date;
  onRetry?: () => void;
  visible: boolean;
}) {
  const dueFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const meta = withVisibility(section, visible);

  return (
    <DashboardWidgetShell
      title="My Onboarding Tasks"
      icon={ClipboardCheck}
      meta={meta}
      onRetry={onRetry}
      emptyMessage={
        <>
          No onboarding tasks assigned to you.{" "}
          <Link
            href={DASHBOARD_ONBOARDING_QUEUE_HREF}
            className="text-primary underline"
          >
            Open onboarding
          </Link>
        </>
      }
    >
      <div className="-mx-4 sm:-mx-5">
        <Table>
          <caption className="sr-only">Pending onboarding tasks</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Task</TableHead>
              <TableHead className="hidden sm:table-cell">Assigned to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Due date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.items.map((task, index) => {
              const dueDate = task.dueDate
                ? new Date(task.dueDate)
                : task.dueDayOffset != null
                  ? addDays(now, task.dueDayOffset)
                  : null;
              const status =
                taskStatus[task.status as keyof typeof taskStatus] ?? {
                  label: task.status,
                  tone: "neutral" as const,
                };

              return (
                <TableRow key={task.id} className="hover:bg-muted/45">
                  <TableCell className="max-w-52 whitespace-normal sm:max-w-none">
                    {task.href ? (
                      <Link
                        href={task.href}
                        className="text-foreground font-medium hover:underline"
                      >
                        {task.title}
                      </Link>
                    ) : (
                      <p className="text-foreground font-medium">{task.title}</p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs sm:hidden">
                      {task.assignee}
                      {dueDate ? ` · ${dueFormatter.format(dueDate)}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          avatarClasses[index % avatarClasses.length],
                        )}
                        aria-hidden="true"
                      >
                        {initials(task.assignee)}
                      </span>
                      <span className="font-medium">{task.assignee}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={status.label}
                      tone={status.tone}
                      className="whitespace-nowrap"
                    />
                  </TableCell>
                  <TableCell className="hidden text-right font-medium md:table-cell">
                    {dueDate ? (
                      <time dateTime={dateKey(dueDate)}>
                        {dueFormatter.format(dueDate)}
                      </time>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </DashboardWidgetShell>
  );
}

function PendingLeaveApprovals({
  section,
  onRetry,
  visible,
}: {
  section: ManagerDashboardPayload["data"]["pendingLeaveApprovals"];
  onRetry?: () => void;
  visible: boolean;
}) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
  });
  const meta = withVisibility(section, visible);

  return (
    <DashboardWidgetShell
      title="Pending Leave Approvals"
      icon={Plane}
      meta={meta}
      onRetry={onRetry}
      emptyMessage="No pending leave approvals."
      className="h-full gap-0 py-0"
    >
      <ul className="space-y-2.5" aria-label="Pending leave approvals">
        {section.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href ?? DASHBOARD_LEAVE_QUEUE_HREF}
              className="border-border bg-card block rounded-lg border px-3 py-2.5 shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
            >
              <p className="text-sm font-semibold">{item.employeeName}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {item.leaveType} · {item.requestedDays} day(s)
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {dateFormatter.format(new Date(item.fromDate))} –{" "}
                {dateFormatter.format(new Date(item.toDate))}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="pt-3 text-right">
        <Link
          href={DASHBOARD_LEAVE_QUEUE_HREF}
          className="text-primary text-xs font-medium underline"
        >
          Open leave queue
        </Link>
      </div>
    </DashboardWidgetShell>
  );
}

function PendingTimesheetApprovals({
  section,
  onRetry,
  visible,
}: {
  section: ManagerDashboardPayload["data"]["pendingTimesheetApprovals"];
  onRetry?: () => void;
  visible: boolean;
}) {
  const meta = withVisibility(section, visible);

  return (
    <DashboardWidgetShell
      title="Pending Timesheets"
      icon={ClipboardCheck}
      meta={meta}
      onRetry={onRetry}
      emptyMessage="No pending timesheet approvals."
      className="h-full gap-0 py-0"
    >
      <ul className="space-y-2.5" aria-label="Pending timesheet approvals">
        {section.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href || DASHBOARD_TIMESHEET_QUEUE_HREF}
              className="border-border bg-card block rounded-lg border px-3 py-2.5 shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
            >
              <p className="font-mono text-sm font-semibold">{item.employeeId}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {item.periodStart} → {item.periodEnd}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {item.totalHours} hours · {item.status}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="pt-3 text-right">
        <Link
          href={DASHBOARD_TIMESHEET_QUEUE_HREF}
          className="text-primary text-xs font-medium underline"
        >
          Open timesheet queue
        </Link>
      </div>
    </DashboardWidgetShell>
  );
}

function AttendanceOverview({
  section,
  onRetry,
  visible,
}: {
  section: ManagerDashboardPayload["data"]["attendance"];
  onRetry?: () => void;
  visible: boolean;
}) {
  return (
    <DashboardWidgetShell
      title="Attendance Overview"
      icon={UserCheck}
      meta={withVisibility(section, visible)}
      onRetry={onRetry}
      emptyMessage="No attendance recorded for today."
    >
      <div className="space-y-4">
        {section.items.map((item) => {
          const tone = attendanceToneClasses[item.tone];
          return (
            <div
              key={item.label}
              className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full",
                    tone.dot,
                  )}
                  aria-hidden="true"
                >
                  <span className="size-1.5 rounded-full bg-current" />
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div
                className="bg-muted h-2 overflow-hidden rounded-full"
                role="progressbar"
                aria-label={`${item.label}: ${item.percentage}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.percentage}
              >
                <div
                  className={cn("h-full rounded-full", tone.bar)}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <span className="text-muted-foreground text-right text-xs font-semibold">
                {item.percentage}%
              </span>
            </div>
          );
        })}
        <div className="text-right">
          <Link
            href="/hr/attendance"
            className="text-primary text-xs font-medium underline"
          >
            Open attendance
          </Link>
        </div>
      </div>
    </DashboardWidgetShell>
  );
}

function RecentJoiners({
  section,
  now,
  onRetry,
  visible,
}: {
  section: ManagerDashboardPayload["data"]["recentJoiners"];
  now: Date;
  onRetry?: () => void;
  visible: boolean;
}) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <DashboardWidgetShell
      title="Recent Joiners"
      icon={Users}
      meta={withVisibility(section, visible)}
      onRetry={onRetry}
      emptyMessage="No recent joiners in this scope."
    >
      <div className="divide-border -mx-4 divide-y sm:-mx-5">
        {section.items.map((joiner, index) => {
          const joinedDate = joiner.joiningDate
            ? new Date(joiner.joiningDate)
            : joiner.joinedDayOffset != null
              ? addDays(now, joiner.joinedDayOffset)
              : null;

          const row = (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-[10px] font-semibold",
                  avatarClasses[index % avatarClasses.length],
                )}
                aria-hidden="true"
              >
                {initials(joiner.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{joiner.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {joiner.designation}
                </p>
              </div>
              {joinedDate ? (
                <time
                  dateTime={dateKey(joinedDate)}
                  className="text-muted-foreground hidden text-xs sm:block"
                >
                  {dateFormatter.format(joinedDate)}
                </time>
              ) : null}
            </div>
          );

          return joiner.href ? (
            <Link key={joiner.id} href={joiner.href} className="block hover:bg-muted/40">
              {row}
            </Link>
          ) : (
            <div key={joiner.id}>{row}</div>
          );
        })}
      </div>
    </DashboardWidgetShell>
  );
}

export function ManagerDashboard({
  payload,
  now = new Date(),
  onRetry,
}: {
  payload: ManagerDashboardPayload;
  now?: Date;
  onRetry?: () => void;
}) {
  const { hasPermission } = useAuth();
  const capabilities = useModuleCapabilities();

  const canSeeOnboarding =
    payload.data.visibility.onboarding &&
    (Boolean(capabilities.data?.onboardingNav) ||
      hasPermission("hr.onboarding.manage") ||
      hasPermission("hr.onboarding.read"));
  const canSeeLeave =
    payload.data.visibility.leave &&
    (hasPermission("hr.leave.approve") ||
      hasPermission("hr.leave.manage") ||
      hasPermission("hr.team.approve"));
  const canSeeTimesheets =
    Boolean(capabilities.data?.projectsNav) &&
    (hasPermission("projects.timesheets.approve") ||
      hasPermission("projects.projects.manage"));
  const canSeeAttendance = payload.data.visibility.attendance;
  const canSeeRecentJoiners = payload.data.visibility.employeeSummary;
  const visibleMetrics = payload.data.metrics.filter((metric) => {
    switch (metric.key) {
      case "total-employees":
        return payload.data.visibility.employeeSummary;
      case "present-today":
        return payload.data.visibility.attendance;
      case "on-leave":
        return payload.data.visibility.leave;
      case "active-onboardings":
        return payload.data.visibility.onboarding;
      default:
        return false;
    }
  });
  const hasHrOverview =
    visibleMetrics.length > 0 || canSeeAttendance || canSeeRecentJoiners;
  const hasDashboardDetails =
    canSeeOnboarding ||
    canSeeAttendance ||
    canSeeRecentJoiners ||
    canSeeLeave ||
    canSeeTimesheets;

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 sm:space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
              Hello {payload.data.manager.fullName}, welcome back
            </h1>
            {payload.source === "demo" ? (
              <Badge
                variant="outline"
                className="border-warning/20 bg-warning-soft text-warning-foreground"
              >
                Sample data
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-brand-secondary/20 bg-brand-secondary-soft text-brand-secondary-strong"
              >
                Live data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {hasHrOverview
              ? "Here is today’s HR operations overview"
              : "Your permitted work is available in the navigation"}
            {payload.data.timezone ? ` (${payload.data.timezone})` : ""}.
          </p>
          {payload.error ? (
            <div className="border-warning/20 bg-warning-soft text-warning-foreground mt-3 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>{payload.error.message}</span>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="underline underline-offset-2"
                >
                  Retry core widgets
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <CalendarDays className="text-primary size-4" aria-hidden="true" />
          <time dateTime={dateKey(now)}>{dateFormatter.format(now)}</time>
        </div>
      </section>

      {visibleMetrics.length > 0 ? (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="HR overview metrics"
        >
          {payload.data.metricsWidget.status === "error" ? (
            <div className="border-border bg-card text-muted-foreground col-span-full rounded-xl border px-4 py-8 text-center text-sm">
              {payload.data.metricsWidget.message ?? "KPIs unavailable."}{" "}
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-primary underline"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : (
            visibleMetrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))
          )}
        </section>
      ) : null}

      {hasDashboardDetails ? (
        <section
          className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
          aria-label="HR dashboard details"
        >
          <div className="min-w-0 space-y-4">
            <UpcomingTasks
              section={payload.data.tasks}
              now={now}
              onRetry={onRetry}
              visible={canSeeOnboarding}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <AttendanceOverview
                section={payload.data.attendance}
                onRetry={onRetry}
                visible={canSeeAttendance}
              />
              <RecentJoiners
                section={payload.data.recentJoiners}
                now={now}
                onRetry={onRetry}
                visible={canSeeRecentJoiners}
              />
            </div>
          </div>
          <div className="space-y-4">
            <PendingLeaveApprovals
              section={payload.data.pendingLeaveApprovals}
              onRetry={onRetry}
              visible={canSeeLeave}
            />
            <PendingTimesheetApprovals
              section={payload.data.pendingTimesheetApprovals}
              onRetry={onRetry}
              visible={canSeeTimesheets}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
