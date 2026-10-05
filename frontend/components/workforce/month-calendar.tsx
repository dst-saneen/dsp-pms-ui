"use client";

import { useMemo, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CalendarDayTone =
  | "neutral"
  | "scheduled"
  | "leave"
  | "holiday"
  | "weekOff"
  | "present"
  | "absent"
  | "pending"
  | "halfDay"
  | "unscheduled";

export interface MonthCalendarDay {
  date: string;
  /** Primary line (leave type, holiday name, or status). */
  label?: string;
  /** Secondary line (half/full day, pending, shift). */
  secondary?: string;
  tone?: CalendarDayTone;
  /** Keep ordinary days quiet while retaining a semantic marker. */
  emphasis?: "filled" | "marker";
  count?: number;
  disabled?: boolean;
}

const toneClass: Record<CalendarDayTone, string> = {
  neutral: "bg-card text-foreground border-border",
  scheduled: "bg-sky-50 text-sky-900 border-sky-200",
  leave: "bg-violet-50 text-violet-900 border-violet-200",
  holiday: "bg-purple-50 text-purple-900 border-purple-200",
  weekOff: "bg-slate-50 text-slate-700 border-slate-200",
  present: "bg-emerald-50 text-emerald-900 border-emerald-200",
  absent: "bg-rose-50 text-rose-900 border-rose-200",
  pending: "bg-amber-50 text-amber-900 border-amber-200",
  halfDay: "bg-cyan-50 text-cyan-950 border-cyan-200",
  unscheduled: "border-dashed border-orange-300 bg-orange-50 text-orange-900",
};

const markerClass: Record<CalendarDayTone, string> = {
  neutral: "bg-slate-400",
  scheduled: "bg-sky-500",
  leave: "bg-violet-500",
  holiday: "bg-purple-500",
  weekOff: "bg-slate-500",
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  pending: "bg-amber-500",
  halfDay: "bg-cyan-500",
  unscheduled: "bg-orange-500",
};

/**
 * The employee calendar is intentionally a quieter, contiguous planner. Keep
 * this mapping local to that variant so roster and workforce calendars retain
 * their established shared presentation.
 */
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
  ...markerClass,
  leave: "bg-violet-500",
  weekOff: "bg-blue-500",
  pending: "bg-primary",
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

interface MonthCalendarProps {
  year: number;
  monthIndex: number;
  days?: MonthCalendarDay[];
  selectedDate?: string | null;
  todayDate?: string | null;
  onSelectDate?: (date: string) => void;
  onMonthChange?: (year: number, monthIndex: number) => void;
  hideNavigation?: boolean;
  /** Opt into the denser, marker-led mobile presentation used by personal calendars. */
  compactMobile?: boolean;
  /** Keep employee calendars as a contiguous planner without affecting roster consumers. */
  variant?: "standard" | "personal";
  className?: string;
}

export function MonthCalendar({
  year,
  monthIndex,
  days = [],
  selectedDate,
  todayDate,
  onSelectDate,
  onMonthChange,
  hideNavigation = false,
  compactMobile = false,
  variant = "standard",
  className,
}: MonthCalendarProps) {
  const isPersonal = variant === "personal";
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const dayMap = useMemo(() => {
    const map = new Map<string, MonthCalendarDay>();
    for (const day of days) map.set(day.date.slice(0, 10), day);
    return map;
  }, [days]);

  const grid = useMemo(() => {
    const first = startOfMonth(year, monthIndex);
    const startOffset = first.getUTCDay();
    const gridStart = addDays(first, -startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const key = toDateKey(date);
      const inMonth = date.getUTCMonth() === monthIndex;
      return { key, inMonth, meta: dayMap.get(key) };
    });
  }, [year, monthIndex, dayMap]);

  const title = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const go = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    onMonthChange?.(next.getUTCFullYear(), next.getUTCMonth());
  };

  function moveFocus(dateKey: string, offset: number) {
    const currentIndex = grid.findIndex((cell) => cell.key === dateKey);
    const target = grid[currentIndex + offset];
    if (!target?.inMonth || target.meta?.disabled) return;
    cellRefs.current.get(target.key)?.focus();
  }

  return (
    <div className={cn("space-y-3", className)}>
      {hideNavigation ? null : (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => go(-1)}
            aria-label="Previous month"
          >
            Prev
          </Button>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => go(1)}
            aria-label="Next month"
          >
            Next
          </Button>
        </div>
      )}

      <div
        className={cn(
          "text-muted-foreground grid grid-cols-7 text-center text-xs font-medium",
          isPersonal ? "border-border border-b" : "gap-1"
        )}
        role="row"
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className={cn(
              "py-1",
              isPersonal && "border-border border-r last:border-r-0"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      <div
        className={cn(
          "grid grid-cols-7",
          isPersonal ? "" : "gap-1"
        )}
        role="grid"
        aria-label={`Calendar ${title}`}
      >
        {grid.map((cell, index) => {
          const selected = cell.inMonth && selectedDate === cell.key;
          const today = cell.inMonth && todayDate === cell.key;
          const tone = cell.meta?.tone ?? "neutral";
          const markerOnly = cell.meta?.emphasis === "marker";
          const disabled = !cell.inMonth || (Boolean(cell.meta?.disabled) && !onSelectDate);
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-current={today ? "date" : undefined}
              disabled={disabled}
              ref={(node) => {
                if (node) cellRefs.current.set(cell.key, node);
                else cellRefs.current.delete(cell.key);
              }}
              onClick={() => {
                if (!cell.inMonth) return;
                onSelectDate?.(cell.key);
              }}
              onKeyDown={(event) => {
                const offsets: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                };
                const offset = offsets[event.key];
                if (!offset) return;
                event.preventDefault();
                moveFocus(cell.key, offset);
              }}
              className={cn(
                "focus-visible:ring-ring min-h-[4.5rem] overflow-hidden border p-1.5 text-left transition focus-visible:ring-2 focus-visible:outline-none",
                isPersonal
                  ? "border-border min-h-24 rounded-none border-r border-b"
                  : "rounded-lg",
                isPersonal && index % 7 === 6 && "border-r-0",
                isPersonal && index >= 35 && "border-b-0",
                compactMobile && "max-sm:min-h-14 max-sm:p-1",
                cell.inMonth
                  ? markerOnly
                    ? isPersonal
                      ? "bg-card text-foreground"
                      : "border-border bg-card text-foreground"
                    : isPersonal
                      ? personalToneClass[tone]
                      : toneClass[tone]
                  : "bg-muted/40 text-muted-foreground border-transparent",
                isPersonal && today && tone === "neutral" && "bg-amber-50",
                selected && !isPersonal && "ring-primary ring-2",
                onSelectDate && "hover:brightness-[0.98]"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    today &&
                      compactMobile &&
                      "max-sm:bg-primary-soft max-sm:text-primary max-sm:rounded-full max-sm:px-1"
                  )}
                >
                  {Number(cell.key.slice(8, 10))}
                </span>
                <span className="flex items-center gap-1">
                  {today ? (
                    <span
                      className={cn(
                        "bg-primary-soft text-primary rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                        compactMobile && "max-sm:sr-only"
                      )}
                    >
                      Today
                    </span>
                  ) : null}
                  {cell.inMonth && cell.meta?.count != null ? (
                    <span className="bg-background/70 rounded-full px-1 text-[10px]">
                      {cell.meta.count}
                    </span>
                  ) : null}
                </span>
              </div>
              {cell.inMonth && cell.meta?.label ? (
                <p
                  className={cn(
                    "mt-1 flex items-start gap-1 text-[10px] leading-tight font-medium",
                    compactMobile && "max-sm:mt-2"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 size-1.5 shrink-0 rounded-full max-sm:size-2",
                      isPersonal ? personalMarkerClass[tone] : markerClass[tone]
                    )}
                    data-event-marker={tone}
                    aria-hidden="true"
                  />
                  <span className={cn("line-clamp-2", compactMobile && "max-sm:sr-only")}>
                    {cell.meta.label}
                  </span>
                </p>
              ) : null}
              {cell.inMonth && cell.meta?.secondary ? (
                <p
                  className={cn(
                    "mt-0.5 line-clamp-2 text-[9px] leading-tight opacity-80",
                    compactMobile && "max-sm:sr-only"
                  )}
                >
                  {cell.meta.secondary}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function privacyStateTone(state: string | null | undefined): CalendarDayTone {
  switch (state) {
    case "ON_LEAVE":
      return "leave";
    case "PENDING_LEAVE":
      return "pending";
    case "HOLIDAY":
      return "holiday";
    case "WEEK_OFF":
      return "weekOff";
    case "PRESENT":
      return "present";
    case "HALF_DAY":
      return "halfDay";
    case "ABSENT":
      return "absent";
    case "UNSCHEDULED":
      return "unscheduled";
    case "SCHEDULED":
    case "AVAILABLE":
      return "scheduled";
    default:
      return "neutral";
  }
}

export function friendlyPrivacyState(state: string | null | undefined): string {
  switch (state) {
    case "AVAILABLE":
      return "Available";
    case "SCHEDULED":
      return "Scheduled";
    case "ON_LEAVE":
      return "On leave";
    case "PENDING_LEAVE":
      return "Pending leave";
    case "HOLIDAY":
      return "Holiday";
    case "WEEK_OFF":
      return "Week off";
    case "PRESENT":
      return "Present";
    case "HALF_DAY":
      return "Half day";
    case "ABSENT":
      return "Absent";
    case "UNSCHEDULED":
      return "Unscheduled";
    default:
      return state?.replaceAll("_", " ") ?? "";
  }
}

export function friendlyApprovalStage(stage: string | null | undefined): string | null {
  switch (stage) {
    case "DRAFT":
      return "Draft";
    case "MANAGER_REVIEW":
      return "Manager review";
    case "HR_REVIEW":
      return "HR review";
    case "APPROVER_REVIEW":
      return "Approver review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return stage?.replaceAll("_", " ") ?? null;
  }
}

export function friendlyDayPortionLabel(portion: string | null | undefined): string | null {
  switch (portion) {
    case "HALF_DAY":
      return "Half day";
    case "FIRST_HALF":
      return "Morning half";
    case "SECOND_HALF":
      return "Afternoon half";
    case "FULL_DAY":
      return "Full day";
    default:
      return null;
  }
}

/** Build primary + secondary labels for personal / team calendar cells. */
export function personalCalendarLabels(input: {
  state?: string | null;
  leaveTypeName?: string | null;
  holidayName?: string | null;
  portion?: string | null;
  shiftName?: string | null;
  leaveStatus?: string | null;
}): { label: string; secondary?: string; tone: CalendarDayTone } {
  const state = input.state ?? "";
  const portionLabel = friendlyDayPortionLabel(input.portion);
  const isHalfPortion =
    input.portion === "HALF_DAY" ||
    input.portion === "FIRST_HALF" ||
    input.portion === "SECOND_HALF";

  let tone = privacyStateTone(state);
  if (state === "HOLIDAY" && isHalfPortion) {
    tone = "halfDay";
  }

  const secondaryParts: string[] = [];

  if (state === "ON_LEAVE" || state === "PENDING_LEAVE") {
    const leaveName = input.leaveTypeName?.trim();
    const label = leaveName || friendlyPrivacyState(state);
    if (state === "PENDING_LEAVE") secondaryParts.push("Pending");
    else secondaryParts.push("Approved");
    if (portionLabel) secondaryParts.push(portionLabel);
    else secondaryParts.push("Full day");
    if (input.holidayName?.trim()) {
      secondaryParts.push(input.holidayName.trim());
    }
    return {
      label,
      secondary: secondaryParts.join(" · "),
      tone,
    };
  }

  if (state === "HOLIDAY") {
    const holidayName = input.holidayName?.trim();
    return {
      label: holidayName || "Holiday",
      secondary: portionLabel ? `${portionLabel} holiday` : "Full-day holiday",
      tone,
    };
  }

  if (state === "WEEK_OFF") {
    return { label: "Week off", tone };
  }

  if (state === "SCHEDULED" || state === "AVAILABLE") {
    if (input.shiftName?.trim()) secondaryParts.push(input.shiftName.trim());
    if (portionLabel && portionLabel !== "Full day") {
      secondaryParts.push(portionLabel);
    }
    return {
      label: friendlyPrivacyState(state),
      secondary: secondaryParts.length ? secondaryParts.join(" · ") : undefined,
      tone,
    };
  }

  if (portionLabel && portionLabel !== "Full day") {
    secondaryParts.push(portionLabel);
  }
  if (input.leaveTypeName?.trim()) {
    secondaryParts.push(input.leaveTypeName.trim());
  }
  if (input.holidayName?.trim()) {
    secondaryParts.push(input.holidayName.trim());
  }

  return {
    label: friendlyPrivacyState(state) || "—",
    secondary: secondaryParts.length ? secondaryParts.join(" · ") : undefined,
    tone,
  };
}
