"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
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

import { useRetryPayrollPayslip, usePayrollPayslipOperations } from "../hooks";
import { formatPeriod } from "../lib/format";
import type { PayrollPayslipOperation } from "../types";

type OperationsFilter = "ALL" | "PENDING" | "STALE" | "FAILED" | "DEAD_LETTER";

function operationsState(row: PayrollPayslipOperation): OperationsFilter {
  if (row.failureCode === "DEAD_LETTER") return "DEAD_LETTER";
  if (
    row.status === "GENERATING" &&
    row.generationLeaseExpiresAt &&
    new Date(row.generationLeaseExpiresAt).getTime() <= Date.now()
  ) {
    return "STALE";
  }
  if (row.status === "FAILED") return "FAILED";
  return "PENDING";
}

function stateLabel(row: PayrollPayslipOperation) {
  const state = operationsState(row);
  return state === "ALL" ? row.status : state.replace("_", " ");
}

export function PayslipOperationsTab() {
  const query = usePayrollPayslipOperations();
  const retry = useRetryPayrollPayslip();
  const [filter, setFilter] = useState<OperationsFilter>("ALL");
  const [selected, setSelected] = useState<PayrollPayslipOperation | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return filter === "ALL" ? items : items.filter((item) => operationsState(item) === filter);
  }, [filter, query.data?.items]);

  const columns: ColumnDef<PayrollPayslipOperation>[] = [
    {
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.displayName}</p>
          <p className="text-muted-foreground text-xs">{row.original.employeeCode}</p>
        </div>
      ),
    },
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => formatPeriod(row.original.payrollYear, row.original.payrollMonth),
    },
    {
      id: "state",
      header: "Operational state",
      cell: ({ row }) => <StatusBadge label={stateLabel(row.original)} tone="neutral" />,
    },
    {
      accessorKey: "generationAttemptCount",
      header: "Attempts",
    },
    {
      id: "lastAttempt",
      header: "Last attempt",
      cell: ({ row }) =>
        row.original.lastAttemptAt
          ? new Date(row.original.lastAttemptAt).toLocaleString()
          : "Not started",
    },
    {
      id: "failure",
      header: "Failure / lease",
      cell: ({ row }) =>
        row.original.failureCode ??
        (row.original.generationLeaseExpiresAt
          ? `Lease ends ${new Date(row.original.generationLeaseExpiresAt).toLocaleString()}`
          : "—"),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.allowedActions.includes("RETRY") ? (
          <Button
            size="sm"
            variant="outline"
            disabled={retry.isPending}
            onClick={() => {
              setSelected(row.original);
              setReason("");
              setError(null);
            }}
          >
            Retry
          </Button>
        ) : null,
    },
  ];

  async function submitRetry(event: React.FormEvent) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!selected || !trimmedReason) {
      setError("A retry reason is required.");
      return;
    }

    setError(null);
    try {
      await retry.mutateAsync({
        id: selected.id,
        data: {
          expectedVersion: selected.version,
          operationId: createOperationId(),
          reason: trimmedReason,
        },
      });
      setSelected(null);
      void query.refetch();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to retry payslip generation."));
      void query.refetch();
    }
  }

  return (
    <>
      <PageToolbar>
        <p className="text-muted-foreground text-sm">
          Retry only failed or stale generation after recording the operational reason.
        </p>
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as OperationsFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All pending work</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="STALE">Stale lease</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="DEAD_LETTER">Dead-lettered</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </PageToolbar>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isLoading}
        error={
          query.error ? getApiErrorMessage(query.error, "Could not load payslip operations.") : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No pending payslip generation"
        emptyDescription="Good — nothing stuck. Failed or stale payslips would list here. Employees open payslips from My Workspace."
        enablePagination
        pageSize={10}
      />

      <FormSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Retry payslip generation"
        description={
          selected
            ? `${selected.displayName} · ${formatPeriod(selected.payrollYear, selected.payrollMonth)}`
            : ""
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button type="submit" form="retry-payslip" disabled={retry.isPending}>
              {retry.isPending ? "Queueing…" : "Queue retry"}
            </Button>
          </div>
        }
      >
        <form id="retry-payslip" className="space-y-3" onSubmit={submitRetry}>
          <div className="space-y-2">
            <Label htmlFor="payslip-retry-reason">Reason</Label>
            <Input
              id="payslip-retry-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this retry is needed"
              maxLength={500}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      </FormSheet>
    </>
  );
}
