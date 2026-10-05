"use client";

import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  eventEffectKind,
  friendlyBusinessDayEffect,
  previewKindToneClass,
  type PreviewDayKind,
} from "./labels";
import type { CalendarEvent } from "./types";

type ViewMode = "list" | "week" | "month";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(value: string) {
  return value.slice(0, 10);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function monthMatrix(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function dominantKind(events: CalendarEvent[]): PreviewDayKind | "INFO" | null {
  if (events.length === 0) return null;
  const kinds = events.map((event) => eventEffectKind(event.businessDayEffect));
  if (kinds.includes("HOLIDAY")) return "HOLIDAY";
  if (kinds.includes("HALF_DAY")) return "HALF_DAY";
  if (kinds.includes("WORKING")) return "WORKING";
  return "INFO";
}

function monthLabel(date: Date) {
  return date.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function EventsCalendarViews({
  events,
  timezoneLabel,
}: {
  events: CalendarEvent[];
  timezoneLabel?: string | null;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Date(`${today}T00:00:00.000Z`);
  });

  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of events) {
      const code = event.eventType?.eventTypeCode ?? "UNKNOWN";
      const name = event.eventType?.eventTypeName ?? code;
      map.set(code, name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of events) {
      const code = event.eventSource?.sourceCode ?? "UNKNOWN";
      const name = event.eventSource?.sourceName ?? code;
      map.set(code, name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

  const filtered = events.filter((event) => {
    if (typeFilter !== "ALL" && (event.eventType?.eventTypeCode ?? "UNKNOWN") !== typeFilter) {
      return false;
    }
    if (sourceFilter !== "ALL" && (event.eventSource?.sourceCode ?? "UNKNOWN") !== sourceFilter) {
      return false;
    }
    return true;
  });

  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthDays = monthMatrix(cursor.getUTCFullYear(), cursor.getUTCMonth());
  const todayKey = new Date().toISOString().slice(0, 10);

  function eventsOn(day: Date) {
    const key = day.toISOString().slice(0, 10);
    return filtered.filter((event) => {
      const start = toDateKey(event.startDate);
      const end = toDateKey(event.endDate);
      return key >= start && key <= end;
    });
  }

  function shiftCursor(direction: -1 | 1) {
    setCursor((d) => {
      if (view === "week") return addDays(d, direction * 7);
      const next = new Date(d);
      next.setUTCMonth(next.getUTCMonth() + direction);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Holidays & events</CardTitle>
          <p className="text-muted-foreground text-xs">
            Same colors as Calendar Preview
            {timezoneLabel ? ` · ${timezoneLabel}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Event views">
          {(["list", "week", "month"] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={view === mode ? "default" : "outline"}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode[0]!.toUpperCase() + mode.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            Type{" "}
            <select
              className="border-border bg-background ml-1 rounded-md border px-2 py-1"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              {typeOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Source{" "}
            <select
              className="border-border bg-background ml-1 rounded-md border px-2 py-1"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              {sourceOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {view !== "list" ? (
            <div className="flex flex-wrap items-center gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => shiftCursor(-1)}>
                Previous
              </Button>
              <span className="min-w-36 px-2 text-center text-sm font-medium">
                {view === "week"
                  ? `Week of ${weekStart.toISOString().slice(0, 10)}`
                  : monthLabel(cursor)}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => shiftCursor(1)}>
                Next
              </Button>
            </div>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No holidays or events in this view. Add one below while the version is a draft.
          </p>
        ) : null}

        {view === "list" ? (
          <ul className="space-y-2" aria-label="Event list">
            {filtered.map((event) => {
              const kind = eventEffectKind(event.businessDayEffect);
              return (
                <li
                  key={event.id}
                  className={cn("rounded-md border p-2 text-sm", previewKindToneClass[kind])}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.eventName}</span>
                    <StatusBadge
                      label={friendlyBusinessDayEffect(event.businessDayEffect)}
                      tone={event.businessDayEffect === "NONE" ? "neutral" : "warning"}
                    />
                    {event.eventType?.eventTypeCode === "HOLIDAY" ? (
                      <StatusBadge
                        label={event.isOptionalHoliday ? "Optional / Floating" : "Mandatory"}
                        tone={event.isOptionalHoliday ? "progress" : "warning"}
                      />
                    ) : null}
                    {event.paidHoliday ? <StatusBadge label="Paid" tone="success" /> : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {toDateKey(event.startDate)}
                    {toDateKey(event.endDate) !== toDateKey(event.startDate)
                      ? ` → ${toDateKey(event.endDate)}`
                      : ""}{" "}
                    · {event.eventType?.eventTypeName ?? "Event"} ·{" "}
                    {event.eventSource?.sourceName ?? "Source"}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : null}

        {view === "week" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-7" role="grid" aria-label="Week view">
            {weekDays.map((day, index) => {
              const key = day.toISOString().slice(0, 10);
              const dayEvents = eventsOn(day);
              const kind = dominantKind(dayEvents);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-24 rounded-md border p-2",
                    kind ? previewKindToneClass[kind] : "border-border bg-background",
                    key === todayKey && "ring-primary/40 ring-2"
                  )}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={`${WEEKDAYS[index]} ${key}, ${dayEvents.length} events`}
                >
                  <p className="text-xs font-medium">
                    {WEEKDAYS[index]} {key.slice(5)}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {dayEvents.map((event) => (
                      <li key={event.id} className="truncate text-[11px]">
                        {event.eventName}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : null}

        {view === "month" ? (
          <>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Month view">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="text-muted-foreground p-1 text-center text-[11px] font-medium"
                >
                  {label}
                </div>
              ))}
              {monthDays.map((day) => {
                const key = day.toISOString().slice(0, 10);
                const inMonth = day.getUTCMonth() === cursor.getUTCMonth();
                const dayEvents = eventsOn(day);
                const kind = dominantKind(dayEvents);
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-16 rounded border p-1 text-[11px]",
                      !inMonth && "opacity-40",
                      kind ? previewKindToneClass[kind] : "border-border bg-background",
                      key === todayKey && "ring-primary/40 ring-2"
                    )}
                    role="gridcell"
                    tabIndex={0}
                    aria-label={`${key}, ${dayEvents.length} events`}
                  >
                    <p className="font-medium">{day.getUTCDate()}</p>
                    {dayEvents.slice(0, 2).map((event) => (
                      <p key={event.id} className="truncate">
                        {event.eventName}
                      </p>
                    ))}
                    {dayEvents.length > 2 ? (
                      <p className="text-muted-foreground">+{dayEvents.length - 2}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              {(
                [
                  ["HOLIDAY", "Holiday"],
                  ["HALF_DAY", "Half day"],
                  ["WORKING", "Working override"],
                  ["INFO", "Info only"],
                ] as const
              ).map(([kind, label]) => (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block size-2.5 rounded-sm border",
                      previewKindToneClass[kind]
                    )}
                  />
                  {label}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
