"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PageToolbar } from "@/components/common/page-toolbar";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { BusinessCalendarAdminService } from "./service";
import {
  classifyPreviewDay,
  friendlyDayPortion,
  friendlyPreviewKind,
  friendlyReasonCode,
  friendlyTraceLayer,
  previewCellLabel,
  type PreviewDayKind,
} from "./labels";
import {
  usePersistedBranchId,
  usePersistedCompanyId,
} from "./use-persisted-selection";

type ViewMode = "day" | "week" | "month";

type PreviewDay = {
  businessDate: string;
  dayStatus?: string;
  dayPortion?: string;
  reasonCode?: string;
  reasonText?: string;
  resolutionTrace?: Array<{ layer: string; code: string; detail: string }>;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const kindTone: Record<PreviewDayKind, string> = {
  WORKING: "bg-emerald-50 text-emerald-900 border-emerald-200",
  HOLIDAY: "bg-amber-50 text-amber-950 border-amber-200",
  WEEK_OFF: "bg-slate-100 text-slate-700 border-slate-200",
  HALF_DAY: "bg-sky-50 text-sky-950 border-sky-200",
};

function normalizeTrace(
  value: PreviewDay["resolutionTrace"] | unknown,
): Array<{ layer: string; code: string; detail: string }> {
  if (Array.isArray(value)) {
    return value.filter(
      (step): step is { layer: string; code: string; detail: string } =>
        !!step && typeof step === "object" && "layer" in step,
    );
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { steps?: unknown }).steps)
  ) {
    return normalizeTrace((value as { steps: unknown }).steps);
  }
  return [];
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - next.getUTCDay());
  return next;
}

function monthBounds(year: number, monthIndex: number) {
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { from: toDateKey(from), to: toDateKey(to) };
}

function weekBounds(dateKey: string) {
  const start = startOfWeek(parseDateKey(dateKey));
  const end = addDays(start, 6);
  return { from: toDateKey(start), to: toDateKey(end), start };
}

function monthMatrix(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function kindOf(day: PreviewDay | undefined): PreviewDayKind | null {
  if (!day?.dayStatus) return null;
  return classifyPreviewDay(day);
}

export function BusinessCalendarPreviewWorkspace() {
  const { hasPermission } = useAuth();
  const canPreview = hasPermission("calendar.business.runtime.preview");
  const today = new Date().toISOString().slice(0, 10);

  const { companyId, setCompanyId, ready: companyReady } =
    usePersistedCompanyId();
  const { branchId, setBranchId, ready: branchReady } =
    usePersistedBranchId(companyId);
  const [view, setView] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const [anchorYear, setAnchorYear] = useState(() =>
    Number(today.slice(0, 4)),
  );
  const [anchorMonth, setAnchorMonth] = useState(() =>
    Number(today.slice(5, 7)) - 1,
  );
  const [showWhy, setShowWhy] = useState(false);

  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
  const companyItems = useMemo(
    () =>
      (companies.data ?? []).map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })),
    [companies.data],
  );
  const branchItems = useMemo(
    () =>
      (branches.data ?? []).map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      })),
    [branches.data],
  );
  const selectedBranch = (branches.data ?? []).find((b) => b.id === branchId);

  const previewRange = useMemo(() => {
    if (view === "day") {
      return { mode: "day" as const, from: selectedDate, to: selectedDate };
    }
    if (view === "week") {
      const bounds = weekBounds(selectedDate);
      return { mode: "week" as const, from: bounds.from, to: bounds.to };
    }
    const bounds = monthBounds(anchorYear, anchorMonth);
    return { mode: "month" as const, from: bounds.from, to: bounds.to };
  }, [view, selectedDate, anchorYear, anchorMonth]);

  const previewQuery = useQuery({
    queryKey: [
      "business-calendar-runtime-preview",
      companyId,
      branchId,
      previewRange.mode,
      previewRange.from,
      previewRange.to,
    ],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<PreviewDay[]> => {
      if (previewRange.mode === "day") {
        const data = await BusinessCalendarAdminService.previewRuntimeDay({
          companyId,
          branchId: branchId || undefined,
          date: previewRange.from,
        });
        const result = (data?.result ?? {}) as PreviewDay;
        return [
          {
            businessDate: previewRange.from,
            dayStatus: result.dayStatus,
            dayPortion: result.dayPortion,
            reasonCode: (result as { reasonCode?: string }).reasonCode,
            reasonText: result.reasonText,
            resolutionTrace: (
              result as { resolutionTrace?: PreviewDay["resolutionTrace"] }
            ).resolutionTrace,
          },
        ];
      }
      const data = await BusinessCalendarAdminService.previewRuntimeRange({
        companyId,
        branchId: branchId || undefined,
        from: previewRange.from,
        to: previewRange.to,
      });
      return (data?.days ?? []) as PreviewDay[];
    },
  });

  const days = useMemo(
    () => (companyId ? (previewQuery.data ?? []) : []),
    [companyId, previewQuery.data],
  );
  const loading = previewQuery.isFetching;
  const error = previewQuery.error
    ? getApiErrorMessage(
        previewQuery.error,
        "Could not load calendar preview.",
      )
    : null;

  const dayMap = useMemo(() => {
    const map = new Map<string, PreviewDay>();
    for (const day of days) {
      map.set(day.businessDate.slice(0, 10), day);
    }
    return map;
  }, [days]);

  const selectedDay = dayMap.get(selectedDate.slice(0, 10));
  const selectedKind = kindOf(selectedDay);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(anchorYear, anchorMonth + delta, 1));
    setAnchorYear(next.getUTCFullYear());
    setAnchorMonth(next.getUTCMonth());
    setSelectedDate(toDateKey(next));
  }

  function shiftWeek(delta: number) {
    const next = addDays(parseDateKey(selectedDate), delta * 7);
    setSelectedDate(toDateKey(next));
    setAnchorYear(next.getUTCFullYear());
    setAnchorMonth(next.getUTCMonth());
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setShowWhy(false);
    const parsed = parseDateKey(date);
    setAnchorYear(parsed.getUTCFullYear());
    setAnchorMonth(parsed.getUTCMonth());
    if (view === "month" || view === "week") {
      // keep current view; detail panel updates from dayMap / reload day view data if needed
    }
  }

  if (!canPreview) {
    return (
      <p className="text-muted-foreground text-sm">
        You do not have permission to preview calendars. Ask an administrator
        for access.
      </p>
    );
  }

  const monthLabel = new Date(Date.UTC(anchorYear, anchorMonth, 1)).toLocaleString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const weekStart = weekBounds(selectedDate).start;

  return (
    <div className="space-y-4 overflow-x-hidden">
      <p className="text-muted-foreground text-sm">
        Choose an office, then browse by day, week, or month to see working days
        and holidays.
      </p>

      <PageToolbar>
        <div className="grid w-full gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <label className="sr-only" htmlFor="business-calendar-preview-company">
            Company
          </label>
          <LookupSelect
            id="business-calendar-preview-company"
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setBranchId("");
            }}
            items={companyItems}
            placeholder="Company"
            loading={companies.isLoading || !companyReady}
          />
          <label className="sr-only" htmlFor="business-calendar-preview-branch">
            Branch
          </label>
          <LookupSelect
            id="business-calendar-preview-branch"
            value={branchId}
            onChange={setBranchId}
            items={branchItems}
            placeholder="Branch (optional)"
            loading={branches.isLoading || !branchReady}
          />
          <div
            className="flex flex-wrap rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="Preview view"
          >
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </PageToolbar>

      {selectedBranch ? (
        <p className="text-muted-foreground text-xs">
          Showing rules for {selectedBranch.name} branch.
        </p>
      ) : companyId ? (
        <p className="text-muted-foreground text-xs">
          Showing company calendar rules (no branch selected).
        </p>
      ) : null}

      {!companyId ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            Select a company to open the calendar preview.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {view === "month"
                    ? monthLabel
                    : view === "week"
                      ? `Week of ${weekBounds(selectedDate).from}`
                      : `Day · ${selectedDate}`}
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {view === "month" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => shiftMonth(-1)}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => shiftMonth(1)}
                    >
                      Next
                    </Button>
                  </>
                ) : null}
                {view === "week" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => shiftWeek(-1)}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => shiftWeek(1)}
                    >
                      Next
                    </Button>
                  </>
                ) : null}
                {view === "day" ? (
                  <Input
                    aria-label="Preview date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => selectDate(e.target.value)}
                    className="w-auto"
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading preview…</p>
              ) : null}

              {view === "month" ? (
                <MonthPreviewGrid
                  year={anchorYear}
                  monthIndex={anchorMonth}
                  dayMap={dayMap}
                  selectedDate={selectedDate}
                  onSelectDate={selectDate}
                />
              ) : null}

              {view === "week" ? (
                <WeekPreviewGrid
                  weekStart={weekStart}
                  dayMap={dayMap}
                  selectedDate={selectedDate}
                  onSelectDate={selectDate}
                />
              ) : null}

              {view === "day" && selectedDay ? (
                <DayResultPanel
                  day={selectedDay}
                  kind={selectedKind}
                  showWhy={showWhy}
                  onToggleWhy={() => setShowWhy((value) => !value)}
                />
              ) : null}

              {view !== "day" ? (
                <Legend />
              ) : null}
            </CardContent>
          </Card>

          {view !== "day" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selected day</CardTitle>
                <p className="text-muted-foreground text-xs">{selectedDate}</p>
              </CardHeader>
              <CardContent>
                {selectedDay ? (
                  <DayResultPanel
                    day={selectedDay}
                    kind={selectedKind}
                    showWhy={showWhy}
                    onToggleWhy={() => setShowWhy((value) => !value)}
                    compact
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Click a day in the calendar.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {(
        [
          ["WORKING", "Working"],
          ["HOLIDAY", "Full-day holiday"],
          ["WEEK_OFF", "Week off"],
          ["HALF_DAY", "Half day"],
        ] as const
      ).map(([kind, label]) => (
        <span
          key={kind}
          className={cn(
            "rounded-md border px-2 py-1",
            kindTone[kind],
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function MonthPreviewGrid({
  year,
  monthIndex,
  dayMap,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  monthIndex: number;
  dayMap: Map<string, PreviewDay>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const cells = monthMatrix(year, monthIndex);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const key = toDateKey(cell);
          const inMonth = cell.getUTCMonth() === monthIndex;
          const day = dayMap.get(key);
          const kind = kindOf(day);
          const selected = key === selectedDate;
          return (
            <button
              key={key}
              type="button"
              disabled={!inMonth}
              onClick={() => onSelectDate(key)}
              title={
                kind && day
                  ? previewCellLabel({
                      kind,
                      reasonText: day.reasonText,
                    })
                  : undefined
              }
              className={cn(
                "min-h-20 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !inMonth && "opacity-30",
                inMonth && kind ? kindTone[kind] : "bg-card border-border",
                selected && "ring-2 ring-primary",
              )}
            >
              <div className="text-sm font-semibold">{cell.getUTCDate()}</div>
              {inMonth && kind ? (
                kind === "HOLIDAY" || kind === "HALF_DAY" ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[10px] font-medium opacity-80">
                      {friendlyPreviewKind(kind)}
                    </div>
                    <div className="line-clamp-2 text-[11px] leading-tight">
                      {day?.reasonText?.trim() ||
                        friendlyPreviewKind(kind)}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] leading-tight">
                    {friendlyPreviewKind(kind)}
                  </div>
                )
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekPreviewGrid({
  weekStart,
  dayMap,
  selectedDate,
  onSelectDate,
}: {
  weekStart: Date;
  dayMap: Map<string, PreviewDay>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const cells = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {cells.map((cell) => {
        const key = toDateKey(cell);
        const day = dayMap.get(key);
        const kind = kindOf(day);
        const selected = key === selectedDate;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDate(key)}
            className={cn(
              "min-h-28 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              kind ? kindTone[kind] : "bg-card border-border",
              selected && "ring-2 ring-primary",
            )}
          >
            <div className="text-xs text-muted-foreground">
              {WEEKDAYS[cell.getUTCDay()]}
            </div>
            <div className="text-lg font-semibold">{cell.getUTCDate()}</div>
            <div className="mt-2 text-xs font-medium">
              {kind ? friendlyPreviewKind(kind) : "—"}
            </div>
            {kind &&
            (kind === "HOLIDAY" || kind === "HALF_DAY") &&
            day?.reasonText ? (
              <p className="mt-1 line-clamp-3 text-[11px] opacity-80">
                {day.reasonText}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DayResultPanel({
  day,
  kind,
  showWhy,
  onToggleWhy,
  compact = false,
}: {
  day: PreviewDay;
  kind: PreviewDayKind | null;
  showWhy: boolean;
  onToggleWhy: () => void;
  compact?: boolean;
}) {
  const resolvedKind = kind ?? "WORKING";
  const trace = normalizeTrace(day.resolutionTrace);
  const holidayName = day.reasonText?.trim();

  return (
    <div className="space-y-3 text-sm">
      <div
        className={cn(
          "rounded-md border px-3 py-2",
          kindTone[resolvedKind],
        )}
      >
        <p className={cn("font-semibold", compact ? "text-base" : "text-lg")}>
          {friendlyPreviewKind(resolvedKind)}
          {day.dayPortion && day.dayPortion !== "FULL_DAY"
            ? ` · ${friendlyDayPortion(day.dayPortion)}`
            : ""}
        </p>
        {holidayName &&
        (resolvedKind === "HOLIDAY" || resolvedKind === "HALF_DAY") ? (
          <p className="mt-1 text-sm font-medium">{holidayName}</p>
        ) : holidayName ? (
          <p className="mt-1 text-sm opacity-90">{holidayName}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">Why this day?</p>
        <p className="text-muted-foreground text-xs">
          {friendlyReasonCode(day.reasonCode)}
          {holidayName ? ` — ${holidayName}` : ""}
        </p>
        {day.dayPortion && day.dayPortion !== "FULL_DAY" ? (
          <p className="text-muted-foreground text-xs">
            Day portion: {friendlyDayPortion(day.dayPortion)}
          </p>
        ) : null}
      </div>

      {trace.length > 0 ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0"
            onClick={onToggleWhy}
          >
            {showWhy ? "Hide details" : "Show more detail"}
          </Button>
          {showWhy ? (
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              {trace.map((step, index) => (
                <li key={`${step.layer}-${index}`}>
                  <span className="font-medium text-foreground">
                    {friendlyTraceLayer(step.layer)}
                  </span>
                  {step.detail ? ` — ${step.detail}` : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
