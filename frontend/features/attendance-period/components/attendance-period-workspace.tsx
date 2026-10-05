"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock } from "lucide-react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
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
import Link from "next/link";

import { CreatePeriodSheet } from "../dialogs/create-period-sheet";
import {
  useAttendancePeriods,
  usePeriodLockBlockers,
  useTransitionAttendancePeriod,
} from "../hooks/use-attendance-periods";
import type { AttendancePeriod, AttendancePeriodAction } from "../types";

const ALL = "ALL";

function periodLabel(period: AttendancePeriod) {
  return new Date(Date.UTC(period.periodYear, period.periodMonth - 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  );
}

function branchLabel(period: AttendancePeriod) {
  return period.branch?.branchName || period.branch?.branchCode || period.branchId;
}

export function nextAttendancePeriodAction(status: string): AttendancePeriodAction | null {
  if (status === "OPEN") return "review";
  // Backend enum is REVIEW (not REVIEWED).
  if (status === "REVIEW" || status === "REVIEWED") return "lock";
  if (status === "LOCKED") return "mark-payroll-pending";
  if (status === "PAYROLL_PENDING") return "close";
  if (status === "CLOSED") return "reopen";
  return null;
}

function actionLabel(action: AttendancePeriodAction) {
  switch (action) {
    case "review":
      return "Send to review";
    case "lock":
      return "Lock month";
    case "mark-payroll-pending":
      return "Ready for payroll";
    case "close":
      return "Close month";
    case "reopen":
      return "Reopen";
    default:
      return action;
  }
}

export function AttendancePeriodWorkspace() {
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState(ALL);
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<AttendancePeriod | null>(null);
  const [action, setAction] = useState<AttendancePeriodAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const canLock = hasPermission("hr.attendance.lock");

  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
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

  const filters = useMemo(
    () => ({
      companyId: companyId || undefined,
      branchId: branchId || undefined,
      status: status === ALL ? undefined : status,
    }),
    [branchId, companyId, status]
  );
  const periodsQuery = useAttendancePeriods(filters);
  const blockers = usePeriodLockBlockers(action === "lock" ? selected : null);
  const transitionMutation = useTransitionAttendancePeriod();

  const columns = useMemo<ColumnDef<AttendancePeriod>[]>(
    () => [
      { header: "Period", cell: ({ row }) => periodLabel(row.original) },
      { header: "Branch", cell: ({ row }) => branchLabel(row.original) },
      {
        header: "Company",
        cell: ({ row }) =>
          row.original.company?.companyName ||
          row.original.company?.companyCode ||
          row.original.companyId,
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusBadge label={row.original.status} tone="neutral" />,
      },
      { header: "Version", accessorKey: "version" },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const next = nextAttendancePeriodAction(row.original.status);
          if (!canLock || !next) return "—";
          return (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openAction(row.original, next)}
              >
                {actionLabel(next)}
              </Button>
              {["LOCKED", "PAYROLL_PENDING"].includes(row.original.status) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openAction(row.original, "reopen")}
                >
                  Reopen
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canLock]
  );

  function openAction(period: AttendancePeriod, next: AttendancePeriodAction) {
    setSelected(period);
    setAction(next);
    setReopenReason("");
    setActionError(null);
    setConfirmOpen(true);
  }

  async function confirmAction() {
    if (!selected || !action) return;
    if (action === "reopen" && !reopenReason.trim()) {
      setActionError("A reason is required to reopen a period.");
      return;
    }
    if (action === "lock" && blockers.isLoading) {
      setActionError("Lock blockers are still being checked.");
      return;
    }
    if (action === "lock" && blockers.error) {
      setActionError(getApiErrorMessage(blockers.error, "Unable to check lock blockers."));
      return;
    }
    if (action === "lock" && (blockers.missingCount > 0 || blockers.submittedCount > 0)) {
      setActionError("Resolve the listed blockers before locking this period.");
      return;
    }
    setActionError(null);
    try {
      await transitionMutation.mutateAsync({
        id: selected.id,
        action,
        input: {
          expectedVersion: selected.version,
          reopenReason: action === "reopen" ? reopenReason.trim() : undefined,
        },
      });
      setConfirmOpen(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Unable to transition attendance period."));
    }
  }

  return (
    <WorkspaceShell>
      <div className="bg-muted/30 rounded-lg border p-4 text-sm">
        <p className="text-foreground font-medium">When to use this</p>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Close a month only after Daily punches look right and Exceptions are cleared (no open
          issues, no fixes waiting for approval). Locking freezes the month for payroll.
        </p>
        <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
          Status path:{" "}
          <strong>OPEN → REVIEW → Lock → LOCKED → Ready for payroll → PAYROLL_PENDING</strong>{" "}
          (enough for payroll) → optional <strong>Close</strong>.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Attendance related pages">
          <Button asChild variant="outline" size="sm">
            <Link href="/hr/attendance">Daily attendance</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/hr/attendance/exceptions${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`}
            >
              Open exceptions
            </Link>
          </Button>
        </nav>
      </div>

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {[ALL, "OPEN", "REVIEW", "LOCKED", "PAYROLL_PENDING", "CLOSED"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value === ALL ? "All statuses" : value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LookupSelect
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setBranchId("");
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
        </div>
        <div className="flex gap-2">
          {canLock ? <Button onClick={() => setCreateOpen(true)}>Create period</Button> : null}
          <Button
            variant="outline"
            onClick={() => void periodsQuery.refetch()}
            disabled={periodsQuery.isFetching}
          >
            {periodsQuery.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </PageToolbar>
      <DataTable
        columns={columns}
        data={periodsQuery.data ?? []}
        isLoading={periodsQuery.isLoading}
        error={
          periodsQuery.error
            ? getApiErrorMessage(periodsQuery.error, "Could not load attendance periods.")
            : null
        }
        onRetry={() => void periodsQuery.refetch()}
        emptyIcon={CalendarClock}
        emptyTitle="No attendance periods"
        emptyDescription="Create a period after selecting the applicable branch."
        enablePagination
      />
      <CreatePeriodSheet open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={action ? `${actionLabel(action)} attendance period` : "Attendance period action"}
        message={
          action === "lock"
            ? "Locking prevents further attendance changes after blockers are resolved."
            : "This changes the period workflow status."
        }
        name={selected ? periodLabel(selected) : "Attendance period"}
        nameLabel="Period"
        code={selected ? branchLabel(selected) : undefined}
        codeLabel="Branch"
        confirmLabel={action ? actionLabel(action) : "Confirm"}
        loading={transitionMutation.isPending}
        loadingLabel="Processing…"
        onConfirm={() => void confirmAction()}
      >
        {action === "lock" ? (
          <div className="space-y-2 text-sm">
            {blockers.isLoading ? <p>Checking lock blockers…</p> : null}
            {blockers.error ? (
              <p className="text-destructive">
                {getApiErrorMessage(blockers.error, "Unable to check lock blockers.")}
              </p>
            ) : null}
            {!blockers.isLoading && !blockers.error ? (
              <>
                <p
                  className={
                    blockers.missingCount || blockers.submittedCount
                      ? "text-amber-700"
                      : "text-muted-foreground"
                  }
                >
                  Open missing-punch exceptions: {blockers.missingCount} · Submitted
                  regularizations: {blockers.submittedCount}
                </p>
                {blockers.missingCount > 0 || blockers.submittedCount > 0 ? (
                  <p className="text-muted-foreground">
                    “Waiting approval” can look empty while a leftover Propose fix still exists.
                    Open{" "}
                    <Link
                      className="text-foreground font-medium underline underline-offset-2"
                      href={`/hr/attendance/exceptions${selected?.branchId ? `?branchId=${encodeURIComponent(selected.branchId)}` : ""}`}
                    >
                      Exceptions
                    </Link>{" "}
                    and cancel pending propose-fix (amber box), or Daily → Correct that day again —
                    then retry Lock.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {action === "reopen" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reopen-reason">
              Reopen reason
            </label>
            <Input
              id="reopen-reason"
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
            />
          </div>
        ) : null}
        {actionError ? <p className="text-destructive text-sm">{actionError}</p> : null}
      </ConfirmActionDialog>
    </WorkspaceShell>
  );
}
