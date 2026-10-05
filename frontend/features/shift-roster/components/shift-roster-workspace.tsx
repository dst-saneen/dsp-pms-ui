"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LockKeyhole,
} from "lucide-react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import {
  MonthCalendar,
  type CalendarDayTone,
  type MonthCalendarDay,
} from "@/components/workforce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";

import { OverrideEntrySheet } from "../dialogs/override-entry-sheet";
import { GenerateRosterSheet } from "../dialogs/generate-roster-sheet";
import {
  useArchiveShiftRoster,
  useLockShiftRoster,
  usePublishShiftRoster,
  useShiftRoster,
  useShiftRosters,
} from "../hooks/use-shift-rosters";
import {
  friendlyDayLabel,
  friendlyDayType,
  friendlyRosterStatus,
} from "../labels";
import type { ShiftRosterEntry, ShiftRosterStatus } from "../types";

type Action = "publish" | "lock" | "archive" | null;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function employeeName(entry: ShiftRosterEntry) {
  const name = [entry.employee?.firstName, entry.employee?.lastName]
    .filter(Boolean)
    .join(" ");
  return name || entry.employee?.employeeCode || entry.employeeId;
}

function statusTone(status: ShiftRosterStatus) {
  if (status === "PUBLISHED") return "success";
  if (status === "LOCKED") return "warning";
  if (status === "ARCHIVED") return "neutral";
  return "progress";
}

function dayTone(dayType: string): CalendarDayTone {
  if (dayType === "WORKING") return "scheduled";
  if (dayType === "HOLIDAY") return "holiday";
  if (dayType === "WEEK_OFF") return "weekOff";
  if (dayType.includes("LEAVE") || dayType === "SCHEDULED_HALF_DAY")
    return "leave";
  return "neutral";
}

type EmployeeGroup = {
  employeeId: string;
  name: string;
  code?: string;
  entries: ShiftRosterEntry[];
  workingDays: number;
  missingShiftDays: number;
};

export function ShiftRosterWorkspace() {
  const { hasPermission } = useAuth();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedRosterId, setSelectedRosterId] = useState<string>();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [overrideEntry, setOverrideEntry] = useState<ShiftRosterEntry | null>(
    null,
  );
  const [action, setAction] = useState<Action>(null);
  const [calendarMonth, setCalendarMonth] = useState<{
    year: number;
    monthIndex: number;
  } | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(
    null,
  );

  const canManage = hasPermission("hr.schedule.manage");
  const canPublish = hasPermission("hr.schedule.publish");
  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
  const rosters = useShiftRosters({
    companyId: companyId || undefined,
    branchId: branchId || undefined,
    status: status === "ALL" ? undefined : status,
  });
  const effectiveRosterId = selectedRosterId ?? rosters.data?.[0]?.id;
  const rosterDetail = useShiftRoster(effectiveRosterId);
  const publish = usePublishShiftRoster();
  const lock = useLockShiftRoster();
  const archive = useArchiveShiftRoster();

  const selectedRoster =
    rosterDetail.data ??
    rosters.data?.find((roster) => roster.id === effectiveRosterId);
  const entries = useMemo(
    () => selectedRoster?.entries ?? [],
    [selectedRoster?.entries],
  );
  const rosterStartMonth = useMemo(() => {
    const date = selectedRoster?.periodStart
      ? new Date(selectedRoster.periodStart)
      : new Date();
    return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
  }, [selectedRoster]);
  const displayedCalendarMonth = calendarMonth ?? rosterStartMonth;

  const employeeGroups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, EmployeeGroup>();
    for (const entry of entries) {
      const existing = map.get(entry.employeeId);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(entry.employeeId, {
          employeeId: entry.employeeId,
          name: employeeName(entry),
          code: entry.employee?.employeeCode,
          entries: [entry],
          workingDays: 0,
          missingShiftDays: 0,
        });
      }
    }
    for (const group of map.values()) {
      group.entries.sort((a, b) => a.workDate.localeCompare(b.workDate));
      group.workingDays = group.entries.filter(
        (e) => e.dayType === "WORKING",
      ).length;
      group.missingShiftDays = group.entries.filter(
        (e) => e.dayType === "WORKING" && !e.shiftId,
      ).length;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  function selectCompany(id: string) {
    setCompanyId(id);
    setBranchId("");
    setSelectedRosterId(undefined);
    setCalendarMonth(null);
    setExpandedEmployeeId(null);
  }

  function selectRoster(id: string) {
    setSelectedRosterId(id);
    setCalendarMonth(null);
    setExpandedEmployeeId(null);
  }

  const calendarDays = useMemo<MonthCalendarDay[]>(() => {
    const grouped = new Map<string, ShiftRosterEntry[]>();
    entries.forEach((entry) => {
      const key = entry.workDate.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });
    return Array.from(grouped, ([date, dayEntries]) => {
      const types = [...new Set(dayEntries.map((entry) => entry.dayType))];
      return {
        date,
        count: dayEntries.length,
        label: types.map((t) => friendlyDayType(t)).join(", "),
        tone: dayTone(types[0] ?? ""),
      };
    });
  }, [entries]);

  const missingShiftEntries = entries.filter(
    (entry) => entry.dayType === "WORKING" && !entry.shiftId,
  );
  const canGenerate = Boolean(branchId);
  const canPublishDraft =
    canPublish &&
    selectedRoster?.status === "DRAFT" &&
    missingShiftEntries.length === 0;
  const publishBlockedReason = !selectedRoster
    ? "Select a draft schedule first."
    : selectedRoster.status !== "DRAFT"
      ? "Only draft schedules can be published."
      : missingShiftEntries.length > 0
        ? `${missingShiftEntries.length} working day(s) have no shift. Assign shifts or regenerate before publish.`
        : null;

  const activeAction =
    action === "publish" ? publish : action === "lock" ? lock : archive;

  async function confirmAction() {
    if (!selectedRoster || !action) return;
    await activeAction.mutateAsync({
      id: selectedRoster.id,
      input: { expectedVersion: selectedRoster.version },
    });
    setAction(null);
  }

  return (
    <WorkspaceShell>
      <KpiGrid columns={3}>
        <KpiCard
          title="Schedules"
          value={rosters.isLoading ? "—" : (rosters.data?.length ?? 0)}
          icon={CalendarDays}
          density="compact"
        />
        <KpiCard
          title="Employee days"
          value={rosterDetail.isLoading ? "—" : entries.length}
          icon={ClipboardList}
          density="compact"
        />
        <KpiCard
          title="Missing shifts"
          value={rosterDetail.isLoading ? "—" : missingShiftEntries.length}
          icon={AlertTriangle}
          tone={missingShiftEntries.length ? "warning" : "success"}
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <LookupSelect
            value={companyId}
            onChange={selectCompany}
            items={companies.data ?? []}
            placeholder="All companies"
          />
          <LookupSelect
            value={branchId}
            onChange={(id) => {
              setBranchId(id);
              setSelectedRosterId(undefined);
              setCalendarMonth(null);
              setExpandedEmployeeId(null);
            }}
            items={branches.data ?? []}
            placeholder="All branches"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {[
                ["ALL", "All statuses"],
                ["DRAFT", "Draft"],
                ["PUBLISHED", "Published"],
                ["LOCKED", "Locked"],
                ["ARCHIVED", "Archived"],
              ].map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void rosters.refetch()}
              disabled={rosters.isFetching}
            >
              {rosters.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            {canManage ? (
              <Button
                disabled={!canGenerate}
                title={
                  canGenerate
                    ? "Build a draft schedule for the selected branch"
                    : "Select a branch first"
                }
                onClick={() => setGenerateOpen(true)}
              >
                Create schedule
              </Button>
            ) : null}
          </div>
          {!canGenerate && canManage ? (
            <p className="text-muted-foreground text-xs">
              Select a branch to create a schedule.
            </p>
          ) : null}
        </div>
      </PageToolbar>

      {rosters.isLoading ? (
        <div className="bg-muted h-48 animate-pulse rounded-xl" />
      ) : null}
      {rosters.error ? (
        <EmptyState
          icon={CalendarDays}
          title="Could not load schedules"
          description={getApiErrorMessage(
            rosters.error,
            "We could not load work schedules.",
          )}
          actionLabel="Retry"
          onAction={() => void rosters.refetch()}
        />
      ) : null}
      {!rosters.isLoading && !rosters.error && !rosters.data?.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No work schedules yet"
          description="Select a branch, then create a schedule for a date range."
        />
      ) : null}

      {rosters.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rosters.data.map((roster) => (
                <button
                  key={roster.id}
                  type="button"
                  onClick={() => selectRoster(roster.id)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    roster.id === effectiveRosterId
                      ? "border-primary bg-primary-soft"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {roster.branch?.branchName ?? "Branch schedule"}
                    </span>
                    <StatusBadge
                      label={friendlyRosterStatus(roster.status)}
                      tone={statusTone(roster.status)}
                    />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatDate(roster.periodStart)} –{" "}
                    {formatDate(roster.periodEnd)} · v{roster.version}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {rosterDetail.isLoading ? (
              <div className="bg-muted h-72 animate-pulse rounded-xl" />
            ) : null}
            {selectedRoster ? (
              <>
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {selectedRoster.branch?.branchName ?? "Schedule"} ·{" "}
                        {formatDate(selectedRoster.periodStart)} –{" "}
                        {formatDate(selectedRoster.periodEnd)}
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Version {selectedRoster.version}
                        {selectedRoster.status === "DRAFT"
                          ? " · Draft (not live for employees yet)"
                          : selectedRoster.status === "PUBLISHED"
                            ? " · Published (live for employees)"
                            : selectedRoster.status === "LOCKED"
                              ? " · Locked (no further edits)"
                              : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="outline"
                          title={
                            selectedRoster.status === "PUBLISHED" ||
                            selectedRoster.status === "LOCKED"
                              ? "Creates a new draft from these dates (does not change the live published schedule). Archive the published one before publishing the new draft."
                              : "Rebuild this draft schedule"
                          }
                          onClick={() => setGenerateOpen(true)}
                        >
                          Rebuild
                        </Button>
                      ) : null}
                      {canPublish && selectedRoster.status === "DRAFT" ? (
                        <Button
                          size="sm"
                          disabled={!canPublishDraft}
                          title={
                            publishBlockedReason ??
                            "Publish this draft to make it live"
                          }
                          onClick={() => setAction("publish")}
                        >
                          Publish
                        </Button>
                      ) : null}
                      {canPublish && selectedRoster.status === "PUBLISHED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAction("lock")}
                        >
                          <LockKeyhole className="mr-1 size-4" />
                          Lock
                        </Button>
                      ) : null}
                      {canPublish && selectedRoster.status !== "ARCHIVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAction("archive")}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MonthCalendar
                      year={displayedCalendarMonth.year}
                      monthIndex={displayedCalendarMonth.monthIndex}
                      days={calendarDays}
                      onMonthChange={(year, monthIndex) =>
                        setCalendarMonth({ year, monthIndex })
                      }
                    />
                  </CardContent>
                </Card>
                {missingShiftEntries.length ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {missingShiftEntries.length} working day
                    {missingShiftEntries.length === 1 ? "" : "s"} have no
                    assigned shift. Publish stays disabled until every working
                    day has a shift (use Change day or fix the default shift,
                    then rebuild).
                  </p>
                ) : null}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      People on this schedule ({employeeGroups.length})
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">
                      Open a person to see their days. {entries.length} day
                      {entries.length === 1 ? "" : "s"} in total.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {employeeGroups.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No people on this schedule yet. Use Create schedule /
                        Rebuild to fill days from the calendar and shifts.
                      </p>
                    ) : (
                      employeeGroups.map((group) => {
                        const open = expandedEmployeeId === group.employeeId;
                        return (
                          <div
                            key={group.employeeId}
                            className="overflow-hidden rounded-lg border"
                          >
                            <button
                              type="button"
                              className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-3 text-left"
                              onClick={() =>
                                setExpandedEmployeeId(
                                  open ? null : group.employeeId,
                                )
                              }
                              aria-expanded={open}
                            >
                              {open ? (
                                <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                              ) : (
                                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {group.name}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {group.code ? `${group.code} · ` : ""}
                                  {group.entries.length} day
                                  {group.entries.length === 1 ? "" : "s"}
                                  {group.workingDays
                                    ? ` · ${group.workingDays} working`
                                    : ""}
                                  {group.missingShiftDays
                                    ? ` · ${group.missingShiftDays} missing shift`
                                    : ""}
                                </p>
                              </div>
                            </button>
                            {open ? (
                              <div className="bg-muted/20 border-t">
                                <table className="w-full min-w-[560px] text-sm">
                                  <thead className="text-muted-foreground border-b text-left text-xs">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">
                                        Date
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Day
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Shift
                                      </th>
                                      <th className="px-3 py-2 text-right font-medium">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.entries.map((entry) => {
                                      const changed =
                                        (entry.overrides?.length ?? 0) > 0;
                                      return (
                                        <tr
                                          key={entry.id}
                                          className="border-b last:border-0"
                                        >
                                          <td className="px-3 py-2.5 whitespace-nowrap">
                                            {formatDate(entry.workDate)}
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span>
                                                {friendlyDayLabel(
                                                  entry.dayType,
                                                  entry.dayPortion,
                                                )}
                                              </span>
                                              {changed ? (
                                                <StatusBadge
                                                  label="Changed"
                                                  tone="information"
                                                />
                                              ) : null}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2.5">
                                            {entry.shift?.shiftName ??
                                              entry.shift?.shiftCode ??
                                              (entry.shiftId ? (
                                                entry.shiftId
                                              ) : (
                                                <span
                                                  className={cn(
                                                    entry.dayType === "WORKING"
                                                      ? "text-amber-700"
                                                      : "text-muted-foreground",
                                                  )}
                                                >
                                                  {entry.dayType === "WORKING"
                                                    ? "No shift"
                                                    : "—"}
                                                </span>
                                              ))}
                                          </td>
                                          <td className="px-3 py-2.5 text-right">
                                            {canManage &&
                                            selectedRoster.status !==
                                              "ARCHIVED" ? (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                  setOverrideEntry(entry)
                                                }
                                              >
                                                Change day
                                              </Button>
                                            ) : changed ? (
                                              <span className="text-muted-foreground text-xs">
                                                Changed
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">
                                                —
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <GenerateRosterSheet
        key={`${generateOpen}-${selectedRoster?.id ?? branchId}`}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        roster={selectedRoster}
        branchId={branchId || undefined}
        onGenerated={(roster) => selectRoster(roster.id)}
      />
      <OverrideEntrySheet
        key={`${overrideEntry?.id ?? "none"}-${Boolean(overrideEntry)}`}
        open={Boolean(overrideEntry)}
        onOpenChange={(open) => !open && setOverrideEntry(null)}
        roster={selectedRoster ?? null}
        entry={overrideEntry}
      />
      <ConfirmActionDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action === "publish"
            ? "Publish schedule"
            : action === "lock"
              ? "Lock schedule"
              : action === "archive"
                ? "Archive schedule"
                : "Update schedule"
        }
        name={selectedRoster?.branch?.branchName ?? "Schedule"}
        code={
          selectedRoster
            ? `${formatDate(selectedRoster.periodStart)} – ${formatDate(selectedRoster.periodEnd)}`
            : undefined
        }
        message={
          action === "publish"
            ? "Publishing makes this schedule live for employees (My Workspace calendar and Today’s Shift). Draft-only changes stay invisible until publish."
            : action === "lock"
              ? "Locking freezes this published schedule so it cannot be edited."
              : action === "archive"
                ? "Archiving retires this schedule. It will no longer be the active one for these dates."
                : "This will update the selected schedule."
        }
        confirmLabel={
          action === "publish"
            ? "Publish"
            : action === "lock"
              ? "Lock"
              : action === "archive"
                ? "Archive"
                : "Confirm"
        }
        loading={activeAction.isPending}
        onConfirm={() => void confirmAction()}
      />
    </WorkspaceShell>
  );
}
