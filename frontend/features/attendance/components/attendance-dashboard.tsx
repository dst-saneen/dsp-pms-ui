"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { CorrectAttendanceSheet } from "../dialogs/correct-attendance-sheet";
import { useAttendanceList } from "../hooks/use-attendance-list";
import {
  formatWorkedDuration,
  friendlyAttendanceStatus,
} from "../lib/attendance-labels";
import type {
  AttendanceRecord,
  AttendanceViewMode,
} from "../types/attendance";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function employeeLabel(item: AttendanceRecord) {
  const name = [item.employee?.firstName, item.employee?.lastName]
    .filter(Boolean)
    .join(" ");
  if (name) {
    return item.employee?.employeeCode
      ? `${name} (${item.employee.employeeCode})`
      : name;
  }
  return item.employee?.employeeCode ?? item.employeeId;
}

/** Prefer first known branch timezone; fall back to local calendar date. */
function branchBusinessDateKey(timezone?: string | null) {
  try {
    if (timezone) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    }
  } catch {
    /* ignore invalid TZ */
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function monthRangeKeys(reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
  return { start, end };
}

export function AttendanceDashboard() {
  const { hasPermission } = useAuth();
  const canCorrect = hasPermission("hr.attendance.manage");
  const [view, setView] = useState<AttendanceViewMode>("today");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const selectedBranchTimezone = useMemo(() => {
    const match = (branches.data ?? []).find((row) => row.id === branchId);
    return (match as { timezone?: string } | undefined)?.timezone ?? null;
  }, [branchId, branches.data]);

  const todayKey = branchBusinessDateKey(selectedBranchTimezone);
  const monthKeys = monthRangeKeys();

  const listFilters = useMemo(() => {
    const base = {
      status: status === "ALL" ? undefined : status,
      companyId: companyId || undefined,
      branchId: branchId || undefined,
      search: search.trim() || undefined,
      page,
      pageSize: 50,
    };
    if (view === "today") {
      return { ...base, fromDate: todayKey, toDate: todayKey };
    }
    if (view === "month") {
      return { ...base, fromDate: monthKeys.start, toDate: monthKeys.end };
    }
    return base;
  }, [status, companyId, branchId, search, page, view, todayKey, monthKeys.start, monthKeys.end]);

  const listQuery = useAttendanceList(listFilters);
  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 1;

  const missingTimezoneHint = items.some(
    (item) => item.employee?.branch && !item.employee.branch.timezone,
  );

  if (listQuery.isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="bg-muted h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (listQuery.error) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Could not load attendance"
        description={getApiErrorMessage(
          listQuery.error,
          "We could not load attendance records.",
        )}
        actionLabel="Retry"
        onAction={() => {
          void listQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "month", "all"] as AttendanceViewMode[]).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={view === mode ? "default" : "outline"}
              onClick={() => {
                setView(mode);
                setPage(1);
              }}
            >
              {mode === "today" ? "Today" : mode === "month" ? "This month" : "All"}
            </Button>
          ))}
          <LookupSelect
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setBranchId("");
              setPage(1);
            }}
            items={companyItems}
            placeholder="Company"
            loading={companies.isLoading}
          />
          <LookupSelect
            value={branchId}
            onChange={(value) => {
              setBranchId(value);
              setPage(1);
            }}
            items={branchItems}
            placeholder="Branch"
            loading={branches.isLoading}
            disabled={!companyId}
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {[
                "ALL",
                "PRESENT",
                "ABSENT",
                "HALF_DAY",
                "LEAVE",
                "HOLIDAY",
                "WEEK_OFF",
              ].map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search employee…"
            className="max-w-sm"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          {listQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </PageToolbar>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Attendance tools">
        <Button asChild variant="outline" size="sm">
          <Link href="/hr/attendance/exceptions">
            Fix punch issues (Exceptions)
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/hr/attendance/periods">Close the month (Period closing)</Link>
        </Button>
      </nav>
      <p className="text-muted-foreground text-xs">
        As HR, fix a bad day with <strong>Correct</strong> (clears exceptions).
        Propose fix → Approve is only when a manager must approve — do not use
        both.
      </p>

      {view === "today" ? (
        <p className="text-muted-foreground text-xs">
          Today uses branch business date {todayKey}
          {selectedBranchTimezone ? ` (${selectedBranchTimezone})` : " (local calendar)"}.
          Select a branch for timezone-accurate Today.
        </p>
      ) : null}

      {missingTimezoneHint ? (
        <p className="text-amber-700 text-sm">
          Some employees are on branches without an IANA timezone. Check-in
          accuracy may be affected until branch timezones are configured.
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No attendance records"
          description="Records appear after employees check in from My Workspace, or adjust filters."
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              Attendance ({total} total · page {page}/{totalPages})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{employeeLabel(item)}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(item.attendanceDate)} · In{" "}
                    {formatTime(item.checkInTime)} · Out{" "}
                    {formatTime(item.checkOutTime)}
                    {" · "}Worked{" "}
                    {formatWorkedDuration(
                      item.checkInTime,
                      item.checkOutTime,
                      item.workedMinutes,
                    )}
                  </p>
                  {(item.scheduledStartAt ||
                    item.scheduledEndAt ||
                    item.lateMinutes != null ||
                    item.earlyDepartureMinutes != null ||
                    item.earlyLeaveMinutes != null ||
                    item.exceptionCount != null ||
                    item.exceptions != null) ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Schedule {formatTime(item.scheduledStartAt)}–
                      {formatTime(item.scheduledEndAt)}
                      {" · "}Late {formatMinutes(item.lateMinutes)}
                      {" · "}Early{" "}
                      {formatMinutes(
                        item.earlyDepartureMinutes ?? item.earlyLeaveMinutes,
                      )}
                      {" · "}Exceptions{" "}
                      {item.exceptionCount ?? item.exceptions?.length ?? "—"}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span title={friendlyAttendanceStatus(item.status).hint}>
                    <StatusBadge
                      label={friendlyAttendanceStatus(item.status).label}
                      tone="neutral"
                    />
                  </span>
                  {canCorrect ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      title="HR can correct punches here with a reason. Or open Exceptions to propose a fix for approval."
                      onClick={() => {
                        setSelected(item);
                        setSheetOpen(true);
                      }}
                    >
                      Correct
                    </Button>
                  ) : null}
                  {(item.exceptionCount ?? item.exceptions?.length ?? 0) > 0 ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/hr/attendance/exceptions?employeeId=${encodeURIComponent(item.employeeId)}${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`}
                      >
                        View issues
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CorrectAttendanceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        record={selected}
      />
    </div>
  );
}
