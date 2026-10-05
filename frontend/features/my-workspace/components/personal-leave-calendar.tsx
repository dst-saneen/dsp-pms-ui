"use client";

import { useMemo, useRef, type ComponentType, type ReactNode } from "react";
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  ListTree,
  Plane,
  Umbrella,
  UserCheck,
  WalletCards,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import {
  MonthCalendar,
  friendlyApprovalStage,
  friendlyDayPortionLabel,
  friendlyPrivacyState,
  personalCalendarLabels,
  type CalendarDayTone,
  type MonthCalendarDay,
} from "@/components/workforce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";

import {
  formatCalendarDate,
  friendlyLeaveStatus,
  matchingLeaveBalance,
  selfDayForDate,
  type PersonalCalendarSelfDay,
} from "../lib/personal-leave-calendar";
import type {
  MyAttendanceRecord,
  MyCalendarDay,
  MyLeaveBalance,
  MyLeaveData,
  MyTodayShift,
} from "../types";

export type PersonalCalendarView = "month" | "week" | "holiday-list" | "leave";

export type PersonalLeaveData = MyLeaveData;

export interface PersonalLeaveCalendarProps {
  view: PersonalCalendarView;
  displayedDate: string;
  selectedDate: string | null;
  businessDate?: string | null;
  timezone?: string | null;
  todayShift?: MyTodayShift | null;
  todayAttendance?: MyAttendanceRecord | null;
  onViewChange: (view: PersonalCalendarView) => void;
  onDisplayedDateChange: (date: string) => void;
  onSelectedDateChange: (date: string) => void;
  days: MyCalendarDay[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  onRetry: () => void;
  balances: MyLeaveBalance[];
  holidayDays?: MyCalendarDay[];
  holidaysLoading?: boolean;
  holidaysError?: unknown;
  holidaysFetching?: boolean;
  onRetryHolidays?: () => void;
  leaveData?: PersonalLeaveData;
  leaveLoading?: boolean;
  leaveError?: unknown;
  leaveFetching?: boolean;
  onRetryLeave?: () => void;
  canApplyLeave?: boolean;
  onApplyLeave: (prefill?: { fromDate?: string }) => void;
  onOpenMyLeave: () => void;
}

const detailToneClass = {
  blue: "bg-sky-50 text-sky-700",
  purple: "bg-purple-50 text-purple-700",
  violet: "bg-violet-50 text-violet-700",
  emerald: "bg-emerald-50 text-emerald-700",
  cyan: "bg-cyan-50 text-cyan-700",
  amber: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
} as const;
type DetailTone = keyof typeof detailToneClass;

function toDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}
function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
function addDays(value: string, days: number) {
  const next = toDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateKey(next);
}
function addMonths(value: string, months: number) {
  const current = toDate(value);
  return toDateKey(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1)));
}
function startOfWeek(value: string) {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return toDateKey(date);
}
function monthTitle(value: string) {
  return toDate(value).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}
function weekTitle(value: string) {
  const start = startOfWeek(value);
  return `${formatCalendarDate(start, "medium")} – ${formatCalendarDate(addDays(start, 6), "medium")}`;
}
function formatClock(value: string | Date | null | undefined, timezone?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone ?? undefined,
  });
}

function attendanceTone(status: string | null | undefined): DetailTone {
  switch ((status ?? "").toUpperCase()) {
    case "PRESENT": return "emerald";
    case "HALF_DAY": return "cyan";
    case "ABSENT": return "rose";
    default: return "orange";
  }
}
function approvalTone(status: string | null | undefined): DetailTone {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED": return "emerald";
    case "REJECTED": return "rose";
    case "CANCELLED": return "slate";
    default: return "amber";
  }
}
function dayStateTone(state: string | null | undefined): DetailTone {
  switch ((state ?? "").toUpperCase()) {
    case "PRESENT": return "emerald";
    case "HALF_DAY": return "cyan";
    case "ABSENT": return "rose";
    case "ON_LEAVE": return "violet";
    case "PENDING_LEAVE": return "amber";
    case "HOLIDAY": return "purple";
    case "WEEK_OFF": return "blue";
    case "UNSCHEDULED": return "orange";
    default: return "blue";
  }
}

function DetailItem({ icon: Icon, label, value, detail, tone, children }: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value?: string | number | null;
  detail?: string | null;
  tone: DetailTone;
  children?: ReactNode;
}) {
  if ((value == null || value === "") && !children) return null;
  return (
    <div className="border-border/80 flex gap-3 border-b py-3 last:border-0">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", detailToneClass[tone])}>
        <Icon className="size-4" aria-hidden={true} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {children ?? <p className="text-foreground mt-0.5 font-semibold">{value}</p>}
        {detail ? <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p> : null}
      </div>
    </div>
  );
}

function DayDetailPanel({
  dateKey, day, balance, businessDate, timezone, todayShift, todayAttendance, canApplyLeave, onApplyLeave,
}: {
  dateKey: string | null;
  day: PersonalCalendarSelfDay | undefined;
  balance: MyLeaveBalance | null;
  businessDate?: string | null;
  timezone?: string | null;
  todayShift?: MyTodayShift | null;
  todayAttendance?: MyAttendanceRecord | null;
  canApplyLeave: boolean;
  onApplyLeave: (prefill?: { fromDate?: string }) => void;
}) {
  if (!dateKey) {
    return <aside className="border-border bg-card rounded-lg border p-4" aria-label="Day details" aria-live="polite">
      <h3 className="font-semibold">Day details</h3>
      <p className="text-muted-foreground mt-2 text-sm">Select a date to review published details.</p>
    </aside>;
  }

  const isToday = dateKey === businessDate;
  const portion = friendlyDayPortionLabel(day?.portion ?? day?.dayPortion);
  const shiftName = day?.shiftName ?? (isToday ? todayShift?.shiftName : null);
  const start = isToday ? formatClock(todayShift?.scheduledStartAt, timezone) : null;
  const end = isToday ? formatClock(todayShift?.scheduledEndAt, timezone) : null;
  const shiftDetail = start && end ? `${start} – ${end}` : start || end;
  const attendanceStatus = day?.attendanceStatus ?? (isToday ? todayAttendance?.status : null);
  const leaveStatus = friendlyLeaveStatus(day?.leaveStatus);
  const approval = friendlyApprovalStage(day?.approvalStage);
  const dayStatus =
    day?.state &&
    !["AVAILABLE", "SCHEDULED"].includes(day.state) &&
    !shiftName &&
    !day.holidayName &&
    !day.leaveTypeName &&
    !attendanceStatus
      ? friendlyPrivacyState(day.state)
      : null;
  const hasPublishedDetails = Boolean(
    shiftName || day?.holidayName || day?.leaveTypeName || attendanceStatus || dayStatus ||
    (portion && !day?.leaveTypeName) || approval
  );

  return (
    <aside className="border-border bg-card overflow-hidden rounded-lg border" aria-label="Day details" aria-live="polite">
      <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">{formatCalendarDate(dateKey)}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{hasPublishedDetails ? "Published day details" : "Selected date"}</p>
        </div>
        {isToday ? <span className="bg-primary-soft text-primary rounded-full px-2 py-1 text-xs font-semibold">Today</span> : null}
      </div>
      <div className="px-4">
        <DetailItem icon={Briefcase} label="Published shift" value={shiftName} detail={shiftDetail} tone="blue" />
        {day?.holidayName ? <DetailItem icon={CalendarDays} label="Holiday" value={day.holidayName} detail={friendlyDayPortionLabel(day.portion ?? day.dayPortion)} tone="purple" /> : null}
        {day?.leaveTypeName ? <DetailItem icon={CalendarDays} label="Leave" value={day.leaveTypeName} detail={[leaveStatus, portion ?? "Full day", balance ? `${balance.balance} days available` : null].filter(Boolean).join(" · ")} tone="violet" /> : null}
        {attendanceStatus ? <DetailItem icon={UserCheck} label="Attendance" value={friendlyPrivacyState(attendanceStatus)} tone={attendanceTone(attendanceStatus)} /> : null}
        {dayStatus ? <DetailItem icon={Clock3} label="Day status" value={dayStatus} detail={day?.dayType ? day.dayType.replaceAll("_", " ") : null} tone={dayStateTone(day?.state)} /> : null}
        {portion && !day?.leaveTypeName ? <DetailItem icon={Clock3} label="Portion" value={portion} detail={day?.dayType ? day.dayType.replaceAll("_", " ") : null} tone="cyan" /> : null}
        {approval ? <DetailItem icon={FileCheck2} label="Approval information" value={approval} tone={approvalTone(day?.approvalStage)} /> : null}
        {!hasPublishedDetails ? <p className="text-muted-foreground py-5 text-sm">No published details for this date.</p> : null}
      </div>
      {canApplyLeave ? <div className="border-border bg-primary-soft/40 border-t p-3">
        <Button type="button" variant="ghost" className="hover:bg-primary-soft h-auto w-full justify-between rounded-md px-3 py-2.5 text-left" onClick={() => onApplyLeave({ fromDate: dateKey })}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-md"><Plane className="size-4" aria-hidden={true} /></span>
            <span><span className="block font-semibold">Apply leave for this date</span><span className="text-muted-foreground block text-xs font-normal">Prefill {formatCalendarDate(dateKey, "medium")}</span></span>
          </span>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </Button>
      </div> : null}
    </aside>
  );
}

const legend: Array<[string, CalendarDayTone, string]> = [
  ["Published shift", "scheduled", "bg-sky-500"],
  ["Present", "present", "bg-emerald-500"],
  ["Approved leave", "leave", "bg-violet-500"],
  ["Pending leave", "pending", "bg-primary"],
  ["Holiday", "holiday", "bg-purple-500"],
  ["Week off", "weekOff", "bg-blue-500"],
  ["Half day", "halfDay", "bg-cyan-500"],
  ["Absent", "absent", "bg-rose-500"],
  ["Unscheduled", "unscheduled", "bg-orange-500"],
];

function calendarMeta(day: MyCalendarDay | undefined): MonthCalendarDay | undefined {
  const self = day?.employees[0];
  if (!self || self.state === "AVAILABLE" || (self.state === "SCHEDULED" && !self.shiftName)) return undefined;
  if (self.state === "SCHEDULED" && self.shiftName) {
    return { date: day?.date ?? "", label: self.shiftName, tone: "scheduled", emphasis: "marker" };
  }
  const labels = personalCalendarLabels({
    state: self.state,
    leaveTypeName: self.leaveTypeName,
    holidayName: self.holidayName,
    portion: self.portion ?? self.dayPortion,
    shiftName: self.shiftName,
    leaveStatus: self.leaveStatus,
  });
  return { date: day?.date ?? "", label: labels.label, secondary: labels.secondary, tone: labels.tone };
}

const personalToneClass: Record<CalendarDayTone, string> = {
  neutral: "bg-card text-foreground",
  scheduled: "bg-sky-50 text-sky-900",
  leave: "bg-violet-50 text-violet-900",
  holiday: "bg-purple-50 text-purple-900",
  weekOff: "bg-blue-50 text-blue-900",
  present: "bg-emerald-50 text-emerald-900",
  absent: "bg-rose-50 text-rose-900",
  pending: "bg-primary-soft text-foreground",
  halfDay: "bg-cyan-50 text-cyan-950",
  unscheduled: "bg-orange-50 text-orange-900",
};
const personalMarkerClass: Record<CalendarDayTone, string> = {
  neutral: "bg-slate-400",
  scheduled: "bg-sky-500",
  leave: "bg-violet-500",
  holiday: "bg-purple-500",
  weekOff: "bg-blue-500",
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  pending: "bg-primary",
  halfDay: "bg-cyan-500",
  unscheduled: "bg-orange-500",
};

function WeekCalendar({ anchorDate, days, selectedDate, todayDate, onSelectDate }: {
  anchorDate: string;
  days: MyCalendarDay[];
  selectedDate: string | null;
  todayDate?: string | null;
  onSelectDate: (date: string) => void;
}) {
  const start = startOfWeek(anchorDate);
  const daysByDate = useMemo(() => new Map(days.map((day) => [day.date.slice(0, 10), day])), [days]);
  const week = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });

  return (
    <div role="grid" aria-label={`Week of ${formatCalendarDate(start, "medium")}`}>
      <div className="border-border text-muted-foreground grid grid-cols-7 border-b text-center text-xs font-medium" role="row">
        {week.map((date) => <div key={date} className="border-border border-r py-2 last:border-r-0">{weekday.format(toDate(date))}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {week.map((date, index) => {
          const meta = calendarMeta(daysByDate.get(date));
          const tone = meta?.tone ?? "neutral";
          const today = date === todayDate;
          const selected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              aria-current={today ? "date" : undefined}
              aria-selected={selected}
              onClick={() => onSelectDate(date)}
              ref={(node) => {
                if (node) cellRefs.current.set(date, node);
                else cellRefs.current.delete(date);
              }}
              onKeyDown={(event) => {
                const offset = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                }[event.key];
                if (!offset) return;
                event.preventDefault();
                const target = addDays(date, offset);
                if (week.includes(target)) cellRefs.current.get(target)?.focus();
              }}
              className={cn(
                "border-border focus-visible:ring-ring min-h-36 overflow-hidden border-r p-2 text-left transition focus-visible:ring-2 focus-visible:outline-none",
                personalToneClass[tone],
                today && tone === "neutral" && "bg-amber-50",
                index === 6 && "border-r-0"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-semibold">{Number(date.slice(8, 10))}</span>
                {today ? <span className="bg-primary-soft text-primary rounded-full px-1.5 py-0.5 text-[9px] font-semibold">Today</span> : null}
              </div>
              {meta?.label ? <p className="mt-3 flex items-start gap-1 text-[11px] leading-tight font-medium"><span className={cn("mt-0.5 size-1.5 shrink-0 rounded-full", personalMarkerClass[tone])} aria-hidden="true" /><span className="line-clamp-3">{meta.label}</span></p> : null}
              {meta?.secondary ? <p className="text-muted-foreground mt-1 line-clamp-2 text-[10px]">{meta.secondary}</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HolidayListPanel({ year, days, isLoading, error, onRetry, onYearChange }: {
  year: number;
  days: MyCalendarDay[];
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  onYearChange: (year: number) => void;
}) {
  const rows = useMemo(() => days.flatMap((day) => {
    const self = day.employees[0];
    if (!self || self.state !== "HOLIDAY") return [];
    return [{
      date: day.date.slice(0, 10),
      name: self.holidayName ?? "Holiday",
      source: self.holidaySource,
      portion: friendlyDayPortionLabel(self.portion ?? self.dayPortion),
    }];
  }).sort((left, right) => left.date.localeCompare(right.date)), [days]);
  return (
    <section aria-label="Holiday list" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold">Published holidays</h2><p className="text-muted-foreground mt-0.5 text-sm">Dates published for your employee calendar.</p></div>
        <label className="text-sm font-medium"><span className="sr-only">Holiday year</span><select aria-label="Holiday year" value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="border-input bg-background h-9 rounded-md border px-3 text-sm">{[year - 1, year, year + 1].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>
      {isLoading ? <div className="space-y-2" role="status" aria-label="Loading holidays">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-12 rounded-md" />)}</div> : null}
      {!isLoading && error ? <EmptyState icon={CircleAlert} title="Could not load holidays" description={getApiErrorMessage(error, "Published holidays are unavailable.")} actionLabel={onRetry ? "Retry holidays" : undefined} onAction={onRetry} /> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">No published holidays for {year}.</div> : null}
      {!isLoading && !error && rows.length > 0 ? <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[38rem] text-left text-sm">
          <caption className="sr-only">Published holidays for {year}</caption>
          <thead className="bg-muted/40 text-muted-foreground text-xs"><tr><th scope="col" className="px-3 py-2.5 font-medium">Date</th><th scope="col" className="px-3 py-2.5 font-medium">Day</th><th scope="col" className="px-3 py-2.5 font-medium">Holiday</th><th scope="col" className="px-3 py-2.5 font-medium">Applies as</th><th scope="col" className="px-3 py-2.5 font-medium">Source</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.date} className="border-border border-t"><td className="px-3 py-2.5 font-medium"><time dateTime={row.date}>{formatCalendarDate(row.date, "medium")}</time></td><td className="px-3 py-2.5">{toDate(row.date).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" })}</td><td className="px-3 py-2.5">{row.name}</td><td className="px-3 py-2.5">{row.portion ?? "Full day"}</td><td className="px-3 py-2.5">{row.source === "BUSINESS_CALENDAR" ? "Business calendar" : row.source === "LEGACY_HOLIDAYS" ? "Holiday calendar" : "Published calendar"}</td></tr>)}</tbody>
        </table>
      </div> : null}
    </section>
  );
}

function formatLeaveStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function LeavePanel({ data, isLoading, error, onRetry, referenceDate, onOpenMyLeave }: {
  data?: PersonalLeaveData;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  referenceDate: string;
  onOpenMyLeave: () => void;
}) {
  const upcoming = [...(data?.history ?? [])]
    .filter((request) =>
      (request.status === "SUBMITTED" || request.status === "APPROVED") &&
      request.toDate >= referenceDate
    )
    .sort((left, right) => left.fromDate.localeCompare(right.fromDate))
    .slice(0, 5);

  return <section aria-label="Leave">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Upcoming leave</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">Your next submitted and approved leave requests.</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onOpenMyLeave}>Open My leave<ChevronRight className="size-4" aria-hidden="true" /></Button>
    </div>
    {isLoading ? <div className="mt-4 space-y-2" role="status" aria-label="Loading upcoming leave">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14 rounded-md" />)}</div> : null}
    {!isLoading && error ? <EmptyState icon={CircleAlert} title="Could not load upcoming leave" description={getApiErrorMessage(error, "Upcoming leave is unavailable.")} actionLabel={onRetry ? "Retry leave" : undefined} onAction={onRetry} /> : null}
    {!isLoading && !error && upcoming.length === 0 ? <p className="text-muted-foreground border-border mt-4 rounded-md border border-dashed px-3 py-6 text-center text-sm">No upcoming leave requests.</p> : null}
    {!isLoading && !error && upcoming.length > 0 ? <ul className="border-border mt-4 overflow-hidden rounded-md border" aria-label="Upcoming leave requests">{upcoming.map((request) => <li key={request.id} className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"><div className="min-w-0"><p className="font-medium">{request.leaveType}</p><p className="text-muted-foreground mt-0.5 text-xs"><time dateTime={request.fromDate}>{request.fromDate === request.toDate ? formatCalendarDate(request.fromDate, "medium") : `${formatCalendarDate(request.fromDate, "medium")} – ${formatCalendarDate(request.toDate, "medium")}`}</time> · {request.requestedDays} {request.requestedDays === 1 ? "day" : "days"}</p></div><span className={cn("rounded-full px-2 py-1 text-xs font-medium", request.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{formatLeaveStatus(request.status)}</span></li>)}</ul> : null}
  </section>;
}

export function PersonalLeaveCalendar({
  view,
  displayedDate,
  selectedDate,
  businessDate,
  timezone,
  todayShift,
  todayAttendance,
  onViewChange,
  onDisplayedDateChange,
  onSelectedDateChange,
  days,
  isLoading,
  isError,
  error,
  isFetching,
  onRetry,
  balances,
  holidayDays = [],
  holidaysLoading = false,
  holidaysError,
  holidaysFetching = false,
  onRetryHolidays,
  leaveData,
  leaveLoading = false,
  leaveError,
  leaveFetching = false,
  onRetryLeave,
  canApplyLeave = false,
  onApplyLeave,
  onOpenMyLeave,
}: PersonalLeaveCalendarProps) {
  const parsed = toDate(displayedDate);
  const year = parsed.getUTCFullYear();
  const monthIndex = parsed.getUTCMonth();
  const title = view === "week" ? weekTitle(displayedDate) : monthTitle(displayedDate);
  const monthPrefix = displayedDate.slice(0, 7);
  const weekStart = startOfWeek(displayedDate);
  const weekEnd = addDays(weekStart, 6);
  const dateIsVisible = (date: string | null | undefined) =>
    Boolean(
      date &&
        (view === "month"
          ? date.startsWith(monthPrefix)
          : view === "week"
            ? date >= weekStart && date <= weekEnd
            : false)
    );
  const activeDate: string | null =
    (dateIsVisible(selectedDate) ? selectedDate : null) ??
    (dateIsVisible(businessDate) ? businessDate ?? null : null);
  const calendarDays = useMemo(() => days.map((day) => calendarMeta(day) ?? { date: day.date, tone: "neutral" as const }), [days]);
  const selectedSelf = activeDate ? selfDayForDate(days, activeDate) : undefined;
  const selectedBalance = matchingLeaveBalance(selectedSelf, balances);
  const workspaceBusy = view === "holiday-list" ? holidaysFetching : view === "leave" ? leaveFetching : isFetching;
  const showCalendar = view === "month" || view === "week";

  function go(delta: number) {
    onDisplayedDateChange(view === "week" ? addDays(displayedDate, delta * 7) : addMonths(displayedDate, delta));
  }
  function goToday() {
    if (!businessDate) return;
    onDisplayedDateChange(businessDate);
    onSelectedDateChange(businessDate);
  }
  function goToDate(nextDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    onDisplayedDateChange(nextDate);
    onSelectedDateChange(nextDate);
  }
  function changeHolidayYear(nextYear: number) {
    onDisplayedDateChange(`${nextYear}-01-01`);
    onSelectedDateChange(`${nextYear}-01-01`);
  }

  return (
    <Tabs value={view} onValueChange={(value) => {
      if (value === "month" || value === "week" || value === "holiday-list" || value === "leave") onViewChange(value);
    }} className="border-border bg-card gap-0 overflow-hidden rounded-lg border shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showCalendar ? <>
            <div className="border-input flex overflow-hidden rounded-md border"><Button type="button" variant="ghost" size="icon-sm" className="border-input rounded-none border-r" onClick={() => go(-1)} aria-label={view === "week" ? "Previous week" : "Previous month"}><ChevronLeft className="size-4" aria-hidden="true" /></Button><Button type="button" variant="ghost" size="icon-sm" className="rounded-none" onClick={() => go(1)} aria-label={view === "week" ? "Next week" : "Next month"}><ChevronRight className="size-4" aria-hidden="true" /></Button></div>
            <Button type="button" variant="outline" size="sm" onClick={goToday} disabled={!businessDate}>Today</Button>
            <Input
              id="personal-calendar-go-to-date"
              type="date"
              aria-label="Go to date"
              value={displayedDate}
              onChange={(event) => goToDate(event.target.value)}
              className="h-9 w-auto max-sm:h-11"
            />
            <p className="min-w-[11rem] text-sm font-semibold tracking-tight">{title}</p>
          </> : <p className="text-sm font-semibold tracking-tight">{view === "holiday-list" ? `Holiday list · ${year}` : `Leave · ${year}`}</p>}
        </div>
        <TabsList aria-label="Personal calendar views" className="h-9 rounded-md max-sm:h-11">
          <TabsTrigger value="month" className="gap-1.5 px-3"><CalendarDays className="size-4" aria-hidden="true" />Month</TabsTrigger>
          <TabsTrigger value="week" className="gap-1.5 px-3"><ListTree className="size-4" aria-hidden="true" />Week</TabsTrigger>
          <TabsTrigger value="holiday-list" className="gap-1.5 px-3"><Umbrella className="size-4" aria-hidden="true" />Holiday List</TabsTrigger>
          <TabsTrigger value="leave" className="gap-1.5 px-3"><WalletCards className="size-4" aria-hidden="true" />Leave</TabsTrigger>
        </TabsList>
      </div>
      {workspaceBusy ? <div className="border-border bg-muted/30 text-muted-foreground border-b px-4 py-1.5 text-xs" role="status">Updating calendar…</div> : null}
      <div className="p-3 sm:p-4">
        {view === "holiday-list" ? <TabsContent value="holiday-list" className="mt-0"><HolidayListPanel year={year} days={holidayDays} isLoading={holidaysLoading} error={holidaysError} onRetry={onRetryHolidays} onYearChange={changeHolidayYear} /></TabsContent> : null}
        {view === "leave" ? <TabsContent value="leave" className="mt-0"><LeavePanel data={leaveData} isLoading={leaveLoading} error={leaveError} onRetry={onRetryLeave} referenceDate={businessDate ?? displayedDate} onOpenMyLeave={onOpenMyLeave} /></TabsContent> : null}
        {showCalendar && isError ? <EmptyState icon={CalendarDays} title="Could not load calendar" description={getApiErrorMessage(error, "Calendar is unavailable.")} actionLabel="Retry" onAction={onRetry} /> : null}
        {showCalendar && !isError && isLoading ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-label="Loading calendar" role="status"><Skeleton className="h-[34rem] rounded-lg" /><Skeleton className="h-80 rounded-lg" /></div> : null}
        {showCalendar && !isError && !isLoading ? <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-3">{view === "month" ? <MonthCalendar year={year} monthIndex={monthIndex} days={calendarDays} selectedDate={activeDate} todayDate={businessDate} hideNavigation compactMobile variant="personal" onSelectDate={onSelectedDateChange} /> : <WeekCalendar anchorDate={displayedDate} days={days} selectedDate={activeDate} todayDate={businessDate} onSelectDate={onSelectedDateChange} />}<div className="border-border text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs" aria-label="Calendar legend">{legend.map(([label, tone, marker]) => <span key={tone} className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", marker)} aria-hidden="true" />{label}</span>)}<span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />Today</span></div></div><DayDetailPanel dateKey={activeDate} day={selectedSelf} balance={selectedBalance} businessDate={businessDate} timezone={timezone} todayShift={todayShift} todayAttendance={todayAttendance} canApplyLeave={canApplyLeave} onApplyLeave={onApplyLeave} /></div> : null}
      </div>
    </Tabs>
  );
}
