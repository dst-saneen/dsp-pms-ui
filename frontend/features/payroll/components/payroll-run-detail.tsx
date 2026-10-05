"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import { EntityDetailLayout } from "@/components/common/entity-detail-layout";
import { ErrorState } from "@/components/common/error-state";
import { FormSheet } from "@/components/common/form-sheet";
import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOperationId } from "@/lib/operation-id";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useCreatePayrollAdjustment,
  usePayrollRun,
  usePayrollRunEmployee,
  usePayrollRunEmployees,
  usePayrollRunHistory,
} from "../hooks";
import { PayrollService } from "../service";
import type {
  PayrollRun,
  PayrollRunAction,
  PayrollRunEmployee,
  PayrollRunEmployeeLine,
} from "../types";
import { formatMoney, formatPeriod } from "../lib/format";
import { groupPreflightIssues } from "../lib/preflight-copy";
import { formatPayrollRunStatus } from "../lib/payroll-run-status";
import { PayrollPathBanner } from "./payroll-path-banner";
import { RunActionDialog } from "./run-action-dialog";

type ActionMode = Extract<
  PayrollRunAction,
  "CALCULATE" | "RETURN_TO_DRAFT" | "APPROVE" | "MARK_PAID" | "CANCEL"
>;

interface PayrollRunDetailProps {
  runId: string;
}

export function PayrollRunDetail({ runId }: PayrollRunDetailProps) {
  const query = usePayrollRun(runId);
  const employees = usePayrollRunEmployees(runId);
  const history = usePayrollRunHistory(runId);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("CALCULATE");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [registerPending, setRegisterPending] = useState(false);

  const employeeDetail = usePayrollRunEmployee(
    runId,
    selectedEmployeeId ?? "",
    Boolean(selectedEmployeeId)
  );

  if (query.isLoading) {
    return <div className="bg-muted/40 h-48 animate-pulse rounded-xl" />;
  }

  if (query.error || !query.data) {
    return (
      <ErrorState
        description={getApiErrorMessage(query.error, "Payroll run not found.")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const run = query.data;
  const selectedEmployee =
    employeeDetail.data ??
    (employees.data ?? []).find((row) => row.employeeId === selectedEmployeeId) ??
    null;

  const actionButtons: Array<{
    mode: ActionMode;
    label: string;
    variant?: "destructive" | "outline" | "default";
  }> = [
    { mode: "CALCULATE", label: "Calculate" },
    { mode: "RETURN_TO_DRAFT", label: "Return to draft", variant: "outline" },
    { mode: "APPROVE", label: "Approve" },
    { mode: "MARK_PAID", label: "Mark paid" },
    { mode: "CANCEL", label: "Cancel", variant: "destructive" },
  ];

  const employeeColumns: ColumnDef<PayrollRunEmployee>[] = [
    { accessorKey: "employeeCode", header: "Code" },
    { accessorKey: "displayName", header: "Employee" },
    { accessorKey: "designationName", header: "Designation" },
    {
      accessorKey: "grossEarnings",
      header: "Gross",
      cell: ({ row }) => formatMoney(row.original.grossEarnings, run.currencyCode),
    },
    {
      accessorKey: "totalDeductions",
      header: "Deductions",
      cell: ({ row }) => formatMoney(row.original.totalDeductions, run.currencyCode),
    },
    {
      accessorKey: "netSalary",
      header: "Net",
      cell: ({ row }) => formatMoney(row.original.netSalary, run.currencyCode),
    },
    {
      id: "view",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedEmployeeId(row.original.employeeId)}
        >
          View lines
        </Button>
      ),
    },
  ];

  function openAction(mode: ActionMode) {
    setActionMode(mode);
    setActionOpen(true);
  }

  async function downloadRegister() {
    setRegisterPending(true);
    try {
      await PayrollService.downloadRegisterCsv(runId);
      toast.success("Register download started.");
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Unable to download register."));
    } finally {
      setRegisterPending(false);
    }
  }

  return (
    <>
      {run.status === "LEGACY_IMPORTED" ? (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <p className="font-medium">Imported historical payroll run</p>
          <p className="text-muted-foreground mt-1 text-xs">
            This is a read-only record. Its payroll lifecycle cannot be run again.
          </p>
        </div>
      ) : (
        <PayrollPathBanner
          current="run-detail"
          runDetailHref={`/hr/payroll/runs/${runId}`}
          note={`Status ${formatPayrollRunStatus(run.status)}. Typical order: Draft → Calculate → Calculated → Approve (different user) → Mark paid → Payslips.`}
        />
      )}
      <EntityDetailLayout
        header={
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-sm">
                <Link href="/hr/payroll?tab=runs" className="hover:underline">
                  Payroll → Runs
                </Link>
              </p>
              <h1 className="text-2xl font-semibold">{run.runNumber}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatPeriod(run.year, run.month)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {run.status !== "LEGACY_IMPORTED" && run.allowedActions.includes("EDIT_ADJUSTMENTS") ? (
                <Button size="sm" variant="outline" onClick={() => setAdjustmentOpen(true)}>
                  Add adjustment
                </Button>
              ) : run.status === "DRAFT" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title="Add adjustment is only available while the run is Draft and you can manage payroll."
                >
                  Add adjustment
                </Button>
              ) : null}
              {run.allowedActions.includes("DOWNLOAD_REGISTER") ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={registerPending}
                  onClick={() => void downloadRegister()}
                >
                  {registerPending ? "Downloading…" : "Download register"}
                </Button>
              ) : run.status !== "LEGACY_IMPORTED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title="Register download needs export permission and a calculated/approved run."
                >
                  Download register
                </Button>
              ) : null}
              {(run.status === "LEGACY_IMPORTED" ? [] : actionButtons).map((button) => {
                const readinessBlocked = run.blockers.length > 0;
                const allowed =
                  run.allowedActions.includes(button.mode) &&
                  !(button.mode === "CALCULATE" && readinessBlocked);
                if (allowed) {
                  return (
                    <Button
                      key={button.mode}
                      size="sm"
                      variant={button.variant ?? "default"}
                      onClick={() => openAction(button.mode)}
                    >
                      {button.label}
                    </Button>
                  );
                }
                const why =
                  button.mode === "APPROVE"
                    ? "Approve needs CALCULATED status and a different user than the maker (payroll approve permission)."
                    : button.mode === "CALCULATE"
                      ? readinessBlocked
                        ? "Resolve the readiness blockers before calculating."
                        : "Calculate is available on Draft runs when you can manage payroll."
                      : button.mode === "MARK_PAID"
                        ? "Mark paid is available after Approve."
                        : button.mode === "RETURN_TO_DRAFT"
                          ? "Return to draft is available on Calculated runs."
                          : "Not available in the current status or for your permissions.";
                return (
                  <Button key={button.mode} size="sm" variant="outline" disabled title={why}>
                    {button.label}
                  </Button>
                );
              })}
            </div>
          </div>
        }
        summary={
          <InfoCard title="Run summary">
            <InfoRow
              label="Status"
              value={
                <StatusBadge
                  label={formatPayrollRunStatus(run.status)}
                  tone="neutral"
                />
              }
            />
            <InfoRow label="Earnings" value={formatMoney(run.totals.earnings, run.currencyCode)} />
            <InfoRow
              label="Deductions"
              value={formatMoney(run.totals.deductions, run.currencyCode)}
            />
            <InfoRow label="Net" value={formatMoney(run.totals.net, run.currencyCode)} />
            <InfoRow label="Version" value={run.version} />
            {run.financeTransactionId ? (
              <InfoRow
                label="Finance link"
                value={
                  <Link
                    href={`/office-finance/transactions/${run.financeTransactionId}`}
                    className="text-primary hover:underline"
                  >
                    View expense
                  </Link>
                }
              />
            ) : null}
          </InfoCard>
        }
      >
        {(run.blockers.length > 0 || run.warnings.length > 0) && (
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Ready notes</CardTitle>
              <p className="text-muted-foreground text-sm font-normal">
                A checklist of people in the company for this pay month — not a list of who was
                paid. Yellow notes do not undo Calculate / Approve / Mark paid.
              </p>
              {run.status === "PAID" || run.status === "APPROVED" ? (
                <p className="text-xs font-normal text-amber-900">
                  This run already moved on. These notes are history for the other active employees
                  who were not set up for pay.
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {groupPreflightIssues(run.blockers).map((group) => (
                <div
                  key={`blocker-${group.code}`}
                  className="border-destructive/30 bg-destructive/5 space-y-1 rounded-md border px-3 py-2"
                >
                  <p className="text-destructive font-medium">
                    {group.title}
                    {group.count > 1 ? ` (${group.count})` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">{group.meaning}</p>
                  {group.people.length > 0 ? (
                    <p className="text-xs">
                      <span className="font-medium">Who: </span>
                      {group.people.join(", ")}
                    </p>
                  ) : null}
                  {group.path ? (
                    <p className="text-xs">
                      <span className="font-medium">Path: </span>
                      {group.href ? (
                        <Link href={group.href} className="underline">
                          {group.path}
                        </Link>
                      ) : (
                        group.path
                      )}
                    </p>
                  ) : null}
                </div>
              ))}
              {groupPreflightIssues(run.warnings).map((group) => (
                <div
                  key={`warning-${group.code}`}
                  className="bg-background/60 space-y-1 rounded-md border border-amber-500/25 px-3 py-2"
                >
                  <p className="font-medium text-amber-950">
                    {group.title}
                    {group.count > 1 ? ` (${group.count} people)` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">{group.meaning}</p>
                  {group.people.length > 0 ? (
                    <p className="text-xs text-amber-950">
                      <span className="font-medium">Who: </span>
                      {group.people.join(", ")}
                    </p>
                  ) : null}
                  {group.path ? (
                    <p className="text-muted-foreground text-xs">
                      <span className="font-medium text-amber-950">Path: </span>
                      {group.href ? (
                        <Link href={group.href} className="underline">
                          {group.path}
                        </Link>
                      ) : (
                        group.path
                      )}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <DataTable
          columns={employeeColumns}
          data={employees.data ?? []}
          isLoading={employees.isLoading}
          error={
            employees.error
              ? getApiErrorMessage(employees.error, "Could not load employees.")
              : null
          }
          onRetry={() => void employees.refetch()}
          emptyTitle={
            run.status === "LEGACY_IMPORTED"
              ? "No employee snapshots in this imported run"
              : "No employee rows"
          }
          emptyDescription={
            run.status === "LEGACY_IMPORTED"
              ? "This historical record has no employee rows to display."
              : "Calculate the run to populate employee snapshots."
          }
          enablePagination
          pageSize={10}
        />

        {selectedEmployeeId && selectedEmployee ? (
          <EmployeeLinesPanel
            employee={selectedEmployee}
            currencyCode={run.currencyCode}
            loading={employeeDetail.isLoading}
            onClose={() => setSelectedEmployeeId(null)}
          />
        ) : null}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Run history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(history.data ?? []).length ? (
              history.data?.map((entry) => (
                <div key={entry.id} className="border-border border-b pb-3 last:border-0">
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-muted-foreground text-sm">
                    {new Date(entry.createdAt).toLocaleString()}
                    {entry.fromStatus || entry.toStatus
                      ? ` · ${entry.fromStatus ?? "—"} → ${entry.toStatus ?? "—"}`
                      : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No history recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </EntityDetailLayout>

      <RunActionDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        run={run}
        mode={actionMode}
        onCompleted={() => {
          void query.refetch();
          void employees.refetch();
          void history.refetch();
        }}
      />

      <AdjustmentDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        run={run}
        employees={employees.data ?? []}
        onCompleted={() => {
          void query.refetch();
          void employees.refetch();
          if (selectedEmployeeId) void employeeDetail.refetch();
        }}
      />
    </>
  );
}

function EmployeeLinesPanel({
  employee,
  currencyCode,
  loading,
  onClose,
}: {
  employee: PayrollRunEmployee;
  currencyCode: string;
  loading: boolean;
  onClose: () => void;
}) {
  const lines = useMemo(() => employee.lines ?? [], [employee.lines]);
  const earnings = lines.filter((line) => line.direction === "EARNING");
  const deductions = lines.filter((line) => line.direction === "DEDUCTION");

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            {employee.displayName} ({employee.employeeCode})
          </CardTitle>
          <p className="text-muted-foreground text-sm">Earning and deduction lines</p>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="bg-muted/40 h-24 animate-pulse rounded-xl" />
        ) : lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">No lines for this employee.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <LineGroup title="Earnings" lines={earnings} currencyCode={currencyCode} />
            <LineGroup title="Deductions" lines={deductions} currencyCode={currencyCode} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LineGroup({
  title,
  lines,
  currencyCode,
}: {
  title: string;
  lines: PayrollRunEmployeeLine[];
  currencyCode: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {lines.length ? (
        lines.map((line) => (
          <div
            key={line.id}
            className="border-border flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
          >
            <div>
              <p className="font-medium">{line.lineName}</p>
              <p className="text-muted-foreground">{line.lineCode}</p>
            </div>
            <p className="tabular-nums">{formatMoney(line.amount, currencyCode)}</p>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground text-sm">None</p>
      )}
    </div>
  );
}

function AdjustmentDialog({
  open,
  onOpenChange,
  run,
  employees,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: PayrollRun;
  employees: PayrollRunEmployee[];
  onCompleted?: () => void;
}) {
  const create = useCreatePayrollAdjustment();
  const [employeeId, setEmployeeId] = useState("");
  const [direction, setDirection] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeId || !amount.trim() || !reason.trim()) {
      setError("Employee, amount, and reason are required.");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        runId: run.id,
        data: {
          employeeId,
          direction,
          sourceType: "MANUAL_ADJUSTMENT",
          amount: amount.trim(),
          reason: reason.trim(),
          expectedVersion: run.version,
          operationId: createOperationId(),
        },
      });
      setEmployeeId("");
      setAmount("");
      setReason("");
      onOpenChange(false);
      onCompleted?.();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to add adjustment."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add adjustment"
      description={run.runNumber}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="payroll-adjustment" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Add adjustment"}
          </Button>
        </div>
      }
    >
      <form id="payroll-adjustment" onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.employeeId} value={employee.employeeId}>
                  {employee.displayName} ({employee.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Direction</Label>
          <Select
            value={direction}
            onValueChange={(value) => setDirection(value as "EARNING" | "DEDUCTION")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EARNING">Earning</SelectItem>
              <SelectItem value="DEDUCTION">Deduction</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adjustment-amount">Amount</Label>
          <Input
            id="adjustment-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adjustment-reason">Reason</Label>
          <Input
            id="adjustment-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
