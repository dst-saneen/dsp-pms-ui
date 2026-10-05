"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useManagers } from "@/features/lookups/hooks/use-managers";
import {
  friendlyExceptionType,
  friendlyExceptionStatus,
} from "@/features/attendance/lib/attendance-labels";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import Link from "next/link";

import { ReviewExceptionSheet } from "../dialogs/review-exception-sheet";
import { SubmitRegularizationSheet } from "../dialogs/submit-regularization-sheet";
import {
  useAttendanceExceptions,
  useAttendanceRegularizations,
  useCancelRegularization,
  useSubmitRegularization,
} from "../hooks/use-attendance-exceptions";
import type {
  AttendanceException,
  AttendanceExceptionFilters,
  AttendanceRegularization,
} from "../types";

const ALL = "ALL";

function employeeLabel(exception: AttendanceException) {
  const employee = exception.employee;
  const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ");
  return name || employee?.employeeCode || exception.employeeId;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function minutes(value?: number | null) {
  return typeof value === "number" ? `${value} min` : "—";
}

export function AttendanceExceptionWorkspace() {
  const searchParams = useSearchParams();
  const initialBranchId = searchParams.get("branchId")?.trim() || "";
  const initialStatus = searchParams.get("status")?.trim() || ALL;
  const initialEmployeeId = searchParams.get("employeeId")?.trim() || "";

  return (
    <AttendanceExceptionWorkspaceContent
      key={`${initialBranchId}:${initialStatus}:${initialEmployeeId}`}
      initialBranchId={initialBranchId}
      initialStatus={initialStatus}
      initialEmployeeId={initialEmployeeId}
    />
  );
}

function AttendanceExceptionWorkspaceContent({
  initialBranchId,
  initialStatus,
  initialEmployeeId,
}: {
  initialBranchId: string;
  initialStatus: string;
  initialEmployeeId: string;
}) {
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState(ALL);
  const [companyId, setCompanyId] = useState("");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [selected, setSelected] = useState<AttendanceRegularization | null>(null);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [regularizeTarget, setRegularizeTarget] = useState<AttendanceException | null>(null);
  const [regularizeOpen, setRegularizeOpen] = useState(false);

  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
  const employees = useManagers(companyId || undefined);
  const companyItems = useMemo(
    () =>
      (companies.data ?? []).map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })),
    [companies.data]
  );
  const branchItems = useMemo(
    () =>
      (branches.data ?? []).map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      })),
    [branches.data]
  );
  const employeeItems = useMemo(
    () =>
      (employees.data ?? []).map((employee) => ({
        id: employee.id,
        code: employee.code,
        name: employee.name,
      })),
    [employees.data]
  );

  const filters = useMemo<AttendanceExceptionFilters>(
    () => ({
      employeeId: employeeId || undefined,
      branchId: branchId || undefined,
      status: status === ALL ? undefined : status,
      type: type === ALL ? undefined : type,
    }),
    [branchId, employeeId, status, type]
  );
  const exceptionsQuery = useAttendanceExceptions(filters);
  const regularizationsQuery = useAttendanceRegularizations({ status: "SUBMITTED" });
  const submitRegularization = useSubmitRegularization();
  const cancelRegularization = useCancelRegularization();
  const canReview = hasPermission("hr.attendance.regularize");
  const canSubmit = canReview || hasPermission("hr.attendance.manage");
  const canCancelPending = canSubmit;
  const submittedByException = useMemo(
    () =>
      new Map(
        (regularizationsQuery.data ?? [])
          .filter((item) => item.attendanceExceptionId)
          .map((item) => [item.attendanceExceptionId as string, item])
      ),
    [regularizationsQuery.data]
  );
  const pendingProposals = regularizationsQuery.data ?? [];

  const columns = useMemo<ColumnDef<AttendanceException>[]>(
    () => [
      {
        header: "Date",
        accessorKey: "businessDate",
        cell: ({ row }) => formatDate(row.original.businessDate),
      },
      { header: "Employee", cell: ({ row }) => employeeLabel(row.original) },
      {
        header: "Exception",
        cell: ({ row }) => {
          const friendly = friendlyExceptionType(row.original.type);
          return <span title={friendly.hint}>{friendly.label}</span>;
        },
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const friendly = friendlyExceptionStatus(row.original.status);
          return (
            <span title={friendly.hint}>
              <StatusBadge label={friendly.label} tone={friendly.tone} />
            </span>
          );
        },
      },
      {
        header: "Late / early",
        cell: ({ row }) => (
          <span className="text-sm">
            {minutes(row.original.attendance?.lateMinutes)} /{" "}
            {minutes(
              row.original.attendance?.earlyDepartureMinutes ??
                row.original.attendance?.earlyLeaveMinutes
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const exception = row.original;
          const regularization = submittedByException.get(exception.id);

          if (canReview && exception.status === "SUBMITTED" && regularization) {
            return (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openReview(regularization, "approve")}
                >
                  Approve fix
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openReview(regularization, "reject")}
                >
                  Reject
                </Button>
              </div>
            );
          }

          if (canSubmit && exception.status === "OPEN" && exception.attendanceId) {
            return (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setRegularizeTarget(exception);
                  setRegularizeOpen(true);
                }}
              >
                Propose fix
              </Button>
            );
          }

          if (exception.status === "RESOLVED" || exception.status === "APPROVED") {
            return (
              <span className="text-muted-foreground text-xs">Cleared — no further action</span>
            );
          }

          if (exception.status === "OPEN") {
            return (
              <span className="text-muted-foreground text-xs">Waiting for a proposed fix</span>
            );
          }

          return "—";
        },
      },
    ],
    [canReview, canSubmit, submittedByException]
  );

  function openReview(regularization: AttendanceRegularization, nextMode: "approve" | "reject") {
    setSelected(regularization);
    setMode(nextMode);
    setSheetOpen(true);
  }

  return (
    <WorkspaceShell>
      <div className="bg-muted/30 rounded-lg border p-4 text-sm">
        <p className="text-foreground font-medium">How this connects</p>
        <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-xs sm:text-sm">
          <li>
            <strong className="text-foreground">As HR:</strong> fix the day on{" "}
            <strong className="text-foreground">Daily → Correct</strong> (set times / Present). That
            clears exceptions — you do <em>not</em> need Propose fix → Approve.
          </li>
          <li>
            <strong className="text-foreground">Propose fix</strong> is for when an employee (or you
            on their behalf) suggests new times that a{" "}
            <strong className="text-foreground">manager must Approve</strong>.
          </li>
          <li>
            If you already used Correct, ignore leftover Approve buttons until you refresh — pending
            proposals are cancelled by Correct.
          </li>
          <li>
            <strong className="text-foreground">Period closing</strong> locks the month after open
            issues are cleared.
          </li>
        </ol>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Attendance related pages">
          <Button asChild variant="outline" size="sm">
            <Link href="/hr/attendance">Daily attendance</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/hr/attendance/periods">Period closing</Link>
          </Button>
        </nav>
      </div>

      {pendingProposals.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-sm">
          <p className="font-medium text-amber-950">
            Pending propose-fix ({pendingProposals.length}) — these block Period Lock even if the
            table below looks empty
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            “Waiting approval” only lists open exception rows. A leftover Propose fix can stay
            pending after Correct. Cancel it here, then Lock.
          </p>
          <ul className="mt-2 space-y-2">
            {pendingProposals.map((item) => {
              const name = [item.employee?.firstName, item.employee?.lastName]
                .filter(Boolean)
                .join(" ");
              const when = item.attendance?.attendanceDate
                ? formatDate(item.attendance.attendanceDate)
                : "Unknown date";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span>
                    {name || item.employeeId} · {when}
                  </span>
                  {canCancelPending ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={cancelRegularization.isPending}
                      onClick={() => void cancelRegularization.mutateAsync(item.id)}
                    >
                      Cancel propose-fix
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {[
                [ALL, "All statuses"],
                ["OPEN", "Needs a fix"],
                ["SUBMITTED", "Waiting approval"],
                ["APPROVED", "Approved"],
                ["REJECTED", "Rejected"],
                ["RESOLVED", "Resolved"],
              ].map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Exception type" />
            </SelectTrigger>
            <SelectContent>
              {[
                [ALL, "All types"],
                ["LATE", "Late check-in"],
                ["EARLY_DEPARTURE", "Left early"],
                ["MISSING_CHECK_IN", "Missing check-in"],
                ["MISSING_CHECK_OUT", "Missing check-out"],
                ["INSUFFICIENT_HOURS", "Short hours"],
                ["UNSCHEDULED_WORK", "Needs schedule review"],
              ].map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LookupSelect
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setBranchId("");
              setEmployeeId("");
            }}
            items={companyItems}
            placeholder="Company"
            loading={companies.isLoading}
          />
          <LookupSelect
            value={branchId}
            onChange={setBranchId}
            items={branchItems}
            placeholder="Branch"
            loading={branches.isLoading}
            disabled={!companyId}
          />
          <LookupSelect
            value={employeeId}
            onChange={setEmployeeId}
            items={employeeItems}
            placeholder="Employee"
            loading={employees.isLoading}
            disabled={!companyId}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void exceptionsQuery.refetch()}
          disabled={exceptionsQuery.isFetching}
        >
          {exceptionsQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </PageToolbar>

      <DataTable
        columns={columns}
        data={exceptionsQuery.data ?? []}
        isLoading={exceptionsQuery.isLoading}
        error={
          exceptionsQuery.error
            ? getApiErrorMessage(exceptionsQuery.error, "Could not load attendance exceptions.")
            : null
        }
        onRetry={() => void exceptionsQuery.refetch()}
        emptyIcon={ClipboardList}
        emptyTitle="No attendance issues"
        emptyDescription="When punches look wrong on Daily, issues appear here. Clear them before Period closing."
        enablePagination
      />

      <ReviewExceptionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        regularization={selected}
        mode={mode}
      />
      <SubmitRegularizationSheet
        open={regularizeOpen}
        onOpenChange={setRegularizeOpen}
        exception={
          regularizeTarget?.attendanceId
            ? {
                id: regularizeTarget.id,
                type: regularizeTarget.type,
                businessDate: regularizeTarget.businessDate,
                attendanceId: regularizeTarget.attendanceId,
                status: regularizeTarget.status,
              }
            : null
        }
        onSubmit={async (input) => {
          await submitRegularization.mutateAsync(input);
          await Promise.all([exceptionsQuery.refetch(), regularizationsQuery.refetch()]);
        }}
      />
    </WorkspaceShell>
  );
}
