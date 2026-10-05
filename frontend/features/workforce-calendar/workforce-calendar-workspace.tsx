"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MonthCalendar,
  friendlyApprovalStage,
  friendlyDayPortionLabel,
  friendlyPrivacyState,
  personalCalendarLabels,
  type MonthCalendarDay,
} from "@/components/workforce";
import { useBranches } from "@/features/branch/hooks/use-branches";
import { useDepartments } from "@/features/department/hooks/use-departments";
import {
  HolidayCalendarLink,
  businessCalendarHref,
} from "@/features/holiday";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useWorkforceCalendar,
  useWorkforceCalendarEmployeeOptions,
} from "./hooks";
import type { WorkforceCalendarEmployeeDay } from "./types";

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function formatCalendarDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function friendlyLeaveStatus(status: string | null | undefined) {
  if (!status) return null;
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replaceAll("_", " ");
  }
}

function isLeaveState(state: string | null | undefined) {
  return state === "ON_LEAVE" || state === "PENDING_LEAVE";
}

/** First name + last initial when helpful in tight calendar cells. */
function shortDisplayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim() || "Employee";
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0)}.`;
}

function formatDayMonth(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDateRange(from: string, to: string) {
  if (from === to) return formatDayMonth(from);
  const fromDay = from.slice(8, 10);
  const toLabel = formatDayMonth(to);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (sameMonth) {
    return `${Number(fromDay)}–${toLabel}`;
  }
  return `${formatDayMonth(from)} – ${toLabel}`;
}

function nextUtcDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

interface LeaveSpan {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  leaveTypeName: string | null;
  state: string;
  leaveStatus: string | null | undefined;
  from: string;
  to: string;
}

/** Collapse consecutive leave days per person into readable spans. */
function buildMonthLeaveSpans(
  days: { date: string; employees: WorkforceCalendarEmployeeDay[] }[],
): LeaveSpan[] {
  const spans: LeaveSpan[] = [];
  const openByEmployee = new Map<string, LeaveSpan>();

  for (const day of days) {
    const onLeaveToday = new Set<string>();
    for (const employee of day.employees) {
      if (!isLeaveState(employee.state)) continue;
      onLeaveToday.add(employee.employeeId);
      const open = openByEmployee.get(employee.employeeId);
      const sameType =
        (open?.leaveTypeName ?? null) === (employee.leaveTypeName ?? null);
      if (open && nextUtcDateKey(open.to) === day.date && sameType) {
        open.to = day.date;
        continue;
      }
      if (open) {
        spans.push(open);
      }
      openByEmployee.set(employee.employeeId, {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        leaveTypeName: employee.leaveTypeName ?? null,
        state: employee.state,
        leaveStatus: employee.leaveStatus,
        from: day.date,
        to: day.date,
      });
    }
    for (const [employeeId, open] of [...openByEmployee.entries()]) {
      if (onLeaveToday.has(employeeId)) continue;
      spans.push(open);
      openByEmployee.delete(employeeId);
    }
  }
  for (const open of openByEmployee.values()) spans.push(open);
  return spans.sort(
    (a, b) => a.from.localeCompare(b.from) || a.fullName.localeCompare(b.fullName),
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

export function WorkforceCalendarWorkspace() {
  const { hasPermission } = useAuth();
  const canOpenBusiness = hasPermission("calendar.business.read");
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const filterKey = `${branchId}:${departmentId}`;
  const [boundFilter, setBoundFilter] = useState(filterKey);

  if (boundFilter !== filterKey) {
    setBoundFilter(filterKey);
    setEmployeeId("");
    setSelectedDate(null);
  }

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const branches = useBranches();
  const departments = useDepartments(branchId || undefined);
  const optionsQuery = useWorkforceCalendarEmployeeOptions({
    branchId: branchId || undefined,
    departmentId: departmentId || undefined,
  });
  const query = useWorkforceCalendar({
    ...range,
    branchId: branchId || undefined,
    departmentId: departmentId || undefined,
    employeeId: employeeId || undefined,
  });

  const employeeOptions = optionsQuery.data?.items ?? [];
  const search = employeeSearch.trim().toLowerCase();
  const visibleOptions = search
    ? employeeOptions.filter((item) => {
        const haystack =
          `${item.fullName} ${item.employeeCode}`.toLowerCase();
        return haystack.includes(search);
      })
    : employeeOptions;
  const selectedEmployee = employeeOptions.find((item) => item.id === employeeId);
  const days = useMemo(() => query.data?.days ?? [], [query.data?.days]);
  const selected = days.find((day) => day.date === selectedDate);
  const selectedPerson = selectedEmployee
    ? selected?.employees[0]
    : undefined;
  const monthLeaveSpans = useMemo(
    () => (selectedEmployee ? [] : buildMonthLeaveSpans(days)),
    [days, selectedEmployee],
  );

  const calendarDays = useMemo<MonthCalendarDay[]>(() => {
    return days.map((day) => {
      if (selectedEmployee) {
        const self = day.employees[0];
        const labels = personalCalendarLabels({
          state: self?.state,
          leaveTypeName: self?.leaveTypeName,
          holidayName: self?.holidayName,
          portion: self?.portion ?? self?.dayPortion,
          shiftName: self?.shiftName,
          leaveStatus: self?.leaveStatus,
        });
        return {
          date: day.date,
          label: labels.label,
          secondary: labels.secondary,
          tone: labels.tone,
        };
      }

      const onLeave = day.employees.filter((employee) =>
        isLeaveState(employee.state),
      );
      if (onLeave.length === 0) {
        return {
          date: day.date,
          tone: "neutral" as const,
        };
      }

      if (onLeave.length === 1) {
        const person = onLeave[0];
        const labels = personalCalendarLabels({
          state: person.state,
          leaveTypeName: person.leaveTypeName,
          holidayName: person.holidayName,
          portion: person.portion ?? person.dayPortion,
          shiftName: person.shiftName,
          leaveStatus: person.leaveStatus,
        });
        return {
          date: day.date,
          count: 1,
          tone: labels.tone,
          label: shortDisplayName(person.fullName),
          secondary: person.leaveTypeName?.trim() || labels.label,
        };
      }

      const names = onLeave
        .slice(0, 2)
        .map((person) => shortDisplayName(person.fullName));
      const overflow = onLeave.length > 2 ? ` +${onLeave.length - 2}` : "";
      const pending = onLeave.some((person) => person.state === "PENDING_LEAVE");
      return {
        date: day.date,
        count: onLeave.length,
        tone: pending ? ("pending" as const) : ("leave" as const),
        label: `${onLeave.length} on leave`,
        secondary: `${names.join(", ")}${overflow}`,
      };
    });
  }, [days, selectedEmployee]);

  function changeMonth(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(null);
  }

  return (
    <WorkspaceShell>
      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[220px]">
            <LookupSelect
              value={branchId}
              onChange={(value) => {
                setBranchId(value);
                setDepartmentId("");
              }}
              items={(branches.data ?? []).map((branch) => ({
                id: branch.id,
                code: branch.branchCode,
                name: branch.branchName,
              }))}
              placeholder="All branches"
              loading={branches.isLoading}
              clearLabel="All branches"
            />
          </div>
          <div className="w-[220px]">
            <LookupSelect
              value={departmentId}
              onChange={setDepartmentId}
              items={(departments.data ?? []).map((department) => ({
                id: department.id,
                code: department.departmentCode,
                name: department.departmentName,
              }))}
              placeholder="All departments"
              loading={departments.isLoading}
              clearLabel="All departments"
            />
          </div>
          <Input
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Search employee"
            className="w-[180px]"
            aria-label="Search employee"
          />
          <div className="w-[240px]">
            <LookupSelect
              value={employeeId}
              onChange={(value) => {
                setEmployeeId(value);
                setSelectedDate(null);
              }}
              items={visibleOptions.map((item) => ({
                id: item.id,
                code: item.employeeCode,
                name: item.isSelf ? `${item.fullName} (you)` : item.fullName,
              }))}
              placeholder="All employees"
              loading={optionsQuery.isLoading}
              clearLabel="All employees"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {canOpenBusiness ? (
            <Button variant="outline" asChild>
              <Link href={businessCalendarHref()}>Business Calendar</Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/hr/leave/holidays">Holidays</Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch();
              void optionsQuery.refetch();
            }}
            disabled={query.isFetching}
          >
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </PageToolbar>

      {selectedEmployee ? (
        <p className="text-muted-foreground text-sm">
          Viewing {selectedEmployee.fullName}{" "}
          <span className="font-mono">({selectedEmployee.employeeCode})</span>
          {optionsQuery.data?.accessMode === "TEAM"
            ? " · your team"
            : " · your HR scope"}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Purple days show who is on leave (name + leave type). The list on the
          right summarizes everyone off this month — click a day for that date
          only, or pick one employee for their personal calendar.
        </p>
      )}

      {query.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading calendar…</p>
      ) : query.error ? (
        <ErrorState
          title="Could not load workforce calendar"
          description={getApiErrorMessage(query.error, "Try again.")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <MonthCalendar
            year={year}
            monthIndex={month}
            days={calendarDays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onMonthChange={changeMonth}
          />
          {selectedEmployee ? (
            <EmployeeDayPanel
              dateKey={selectedDate}
              employeeName={selectedEmployee.fullName}
              day={selectedPerson}
            />
          ) : (
            <aside className="rounded-lg border p-4" aria-live="polite">
              {selectedDate ? (
                <>
                  <h3 className="font-semibold">
                    {formatCalendarDate(selectedDate)}
                  </h3>
                  {selected?.employees.length ? (
                    <DayEmployeeList
                      employees={selected.employees}
                      onOpen={(employeeIdValue) => {
                        setEmployeeId(employeeIdValue);
                        setSelectedDate(selectedDate);
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={UsersRound}
                      title="No employees"
                      description="No visible employees were returned for this day."
                      compact
                    />
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-semibold">On leave this month</h3>
                  {monthLeaveSpans.length ? (
                    <div className="mt-3 space-y-3">
                      {monthLeaveSpans.map((span) => (
                        <div
                          key={`${span.employeeId}:${span.from}:${span.to}`}
                          className="border-b pb-2 last:border-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {span.fullName}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {span.leaveTypeName?.trim() || "Leave"}
                                {span.state === "PENDING_LEAVE"
                                  ? " · Pending"
                                  : ""}
                                {" · "}
                                {formatDateRange(span.from, span.to)}
                              </p>
                              <p className="text-muted-foreground font-mono text-[11px]">
                                {span.employeeCode}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEmployeeId(span.employeeId);
                                setSelectedDate(span.from);
                              }}
                            >
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-sm">
                      Nobody in this view is on leave this month. Approved leave
                      shows here after HR final approve.
                    </p>
                  )}
                </>
              )}
            </aside>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}

function EmployeeDayPanel({
  dateKey,
  employeeName,
  day,
}: {
  dateKey: string | null;
  employeeName: string;
  day: WorkforceCalendarEmployeeDay | undefined;
}) {
  const portion = friendlyDayPortionLabel(day?.portion ?? day?.dayPortion);
  if (!dateKey) {
    return (
      <aside className="rounded-lg border p-4" aria-live="polite">
        <h3 className="font-semibold">{employeeName}</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Click a date to see leave type, half/full day, status, holiday, and
          approval stage.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border p-4" aria-live="polite">
      <h3 className="font-semibold">{formatCalendarDate(dateKey)}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{employeeName}</p>
      <dl className="mt-3 space-y-0">
        <DetailRow
          label="Status"
          value={friendlyPrivacyState(day?.state) || "Working day"}
        />
        <DetailRow label="Leave type" value={day?.leaveTypeName} />
        <DetailRow
          label="Portion"
          value={
            portion ??
            (day?.leaveTypeName || day?.holidayName ? "Full day" : null)
          }
        />
        <DetailRow
          label="Leave status"
          value={friendlyLeaveStatus(day?.leaveStatus)}
        />
        <DetailRow
          label="Approval stage"
          value={friendlyApprovalStage(day?.approvalStage)}
        />
        {day?.holidayName ? (
          <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
            <dt className="text-muted-foreground text-sm">Holiday</dt>
            <dd className="text-right text-sm font-medium">
              <HolidayCalendarLink
                holidayName={day.holidayName}
                source={day.holidaySource}
                calendarId={day.holidayCalendarId}
              />
            </dd>
          </div>
        ) : null}
        <DetailRow label="Shift" value={day?.shiftName} />
      </dl>
    </aside>
  );
}

function DayEmployeeList({
  employees,
  onOpen,
}: {
  employees: WorkforceCalendarEmployeeDay[];
  onOpen: (employeeId: string) => void;
}) {
  const onLeave = employees.filter((employee) => isLeaveState(employee.state));
  const others = employees.filter((employee) => !isLeaveState(employee.state));

  return (
    <div className="mt-3 space-y-4">
      {onLeave.length ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            On leave ({onLeave.length})
          </p>
          {onLeave.map((employee) => (
            <EmployeeRow
              key={employee.employeeId}
              employee={employee}
              onOpen={() => onOpen(employee.employeeId)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Nobody on leave this day.</p>
      )}
      {others.length ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Others ({others.length})
          </p>
          {others.map((employee) => (
            <EmployeeRow
              key={employee.employeeId}
              employee={employee}
              onOpen={() => onOpen(employee.employeeId)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmployeeRow({
  employee,
  onOpen,
}: {
  employee: WorkforceCalendarEmployeeDay;
  onOpen: () => void;
}) {
  const labels = personalCalendarLabels({
    state: employee.state,
    leaveTypeName: employee.leaveTypeName,
    holidayName: employee.holidayName,
    portion: employee.portion ?? employee.dayPortion,
    shiftName: employee.shiftName,
    leaveStatus: employee.leaveStatus,
  });

  return (
    <div className="border-b pb-2 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{employee.fullName}</p>
          <p className="text-muted-foreground text-xs">
            {employee.employeeCode} · {labels.label}
            {labels.secondary ? ` · ${labels.secondary}` : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
          Open
        </Button>
      </div>
    </div>
  );
}
