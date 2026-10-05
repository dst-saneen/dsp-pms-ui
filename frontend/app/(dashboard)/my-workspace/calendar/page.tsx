"use client";

import { useMemo, useState } from "react";
import { RefreshCw, UserRoundX } from "lucide-react";
import { useRouter } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  PersonalLeaveCalendar,
  type PersonalCalendarView,
} from "@/features/my-workspace/components/personal-leave-calendar";
import {
  useMyHolidayCalendar,
  useMyLeave,
  useMyWorkforceCalendar,
  useMyWorkspace,
} from "@/features/my-workspace/hooks/use-my-workspace";
import { useAuth } from "@/providers/auth-provider";

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthBounds(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  return {
    fromDate: dateKey(new Date(Date.UTC(year, monthIndex, 1))),
    toDate: dateKey(new Date(Date.UTC(year, monthIndex + 1, 0))),
  };
}

function weekBounds(value: string) {
  const start = new Date(`${value}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { fromDate: dateKey(start), toDate: dateKey(end) };
}

function validDate(value: string | null | undefined) {
  return Boolean(value?.match(/^\d{4}-\d{2}-\d{2}$/));
}

export default function MyWorkspaceCalendarPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const linked = Boolean(user?.employeeId);
  const canApplyLeave = hasPermission("hr.self.manage");
  const [fallbackDate] = useState(() => dateKey(new Date()));
  const [view, setView] = useState<PersonalCalendarView>("month");
  const [cursorDate, setCursorDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const workspace = useMyWorkspace(linked);
  const businessDate = validDate(workspace.data?.businessDate) ? workspace.data?.businessDate : null;
  const displayedDate = cursorDate ?? businessDate ?? fallbackDate;
  const year = Number(displayedDate.slice(0, 4));
  const range = useMemo(
    () => (view === "week" ? weekBounds(displayedDate) : monthBounds(displayedDate)),
    [displayedDate, view]
  );
  const calendarEnabled = linked && (view === "month" || view === "week");
  const calendar = useMyWorkforceCalendar(range.fromDate, range.toDate, calendarEnabled);
  const holidays = useMyHolidayCalendar(year, linked && view === "holiday-list");
  const leave = useMyLeave(year, linked && view === "leave");

  if (!linked) {
    return (
      <PageContainer>
        <PageHeader title="My calendar" description="View your schedule, leave, and important dates." />
        <section className="border-border bg-card flex min-h-48 flex-col items-center justify-center rounded-lg border px-4 py-8 text-center">
          <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md">
            <UserRoundX className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-base font-semibold">Employee profile not linked</h2>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            Your calendar becomes available after your user account is linked to an employee profile.
          </p>
        </section>
      </PageContainer>
    );
  }

  const refreshing =
    workspace.isFetching ||
    (view === "holiday-list" ? holidays.isFetching : view === "leave" ? leave.isFetching : calendar.isFetching);

  function applyLeave(prefill?: { fromDate?: string }) {
    const query = new URLSearchParams({ action: "apply" });
    if (prefill?.fromDate) query.set("fromDate", prefill.fromDate);
    router.push(`/my-workspace/leave?${query.toString()}`);
  }

  function refresh() {
    const activeRefetch =
      view === "holiday-list" ? holidays.refetch : view === "leave" ? leave.refetch : calendar.refetch;
    void Promise.all([workspace.refetch(), activeRefetch()]);
  }

  return (
    <PageContainer>
      <PageHeader
        title="My calendar"
        description="View your schedule, leave, and important dates."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" aria-label="Refresh calendar" disabled={refreshing} onClick={refresh}>
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </>
        }
      />

      <PersonalLeaveCalendar
        view={view}
        displayedDate={displayedDate}
        selectedDate={selectedDate ?? businessDate ?? displayedDate}
        businessDate={businessDate}
        timezone={workspace.data?.timezone ?? workspace.data?.identity.timezone}
        todayShift={workspace.data?.todayShift}
        todayAttendance={workspace.data?.todayAttendance}
        onViewChange={setView}
        onDisplayedDateChange={setCursorDate}
        onSelectedDateChange={setSelectedDate}
        days={calendar.data?.days ?? []}
        isLoading={calendar.isLoading}
        isError={calendar.isError}
        error={calendar.error}
        isFetching={calendar.isFetching}
        onRetry={() => { void calendar.refetch(); }}
        balances={workspace.data?.leave?.balances ?? []}
        holidayDays={holidays.data}
        holidaysLoading={holidays.isLoading}
        holidaysError={holidays.error}
        holidaysFetching={holidays.isFetching}
        onRetryHolidays={() => { void holidays.refetch(); }}
        leaveData={leave.data}
        leaveLoading={leave.isLoading}
        leaveError={leave.error}
        leaveFetching={leave.isFetching}
        onRetryLeave={() => { void leave.refetch(); }}
        canApplyLeave={canApplyLeave}
        onApplyLeave={applyLeave}
        onOpenMyLeave={() => router.push("/my-workspace/leave")}
      />
    </PageContainer>
  );
}
