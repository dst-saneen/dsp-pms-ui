"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { useOvertimeRequests } from "./hooks";
import { OvertimeProcessSheet } from "./overtime-process-sheet";
import type { OvertimeRequest } from "./types";

type ProcessMode = "approve" | "reject" | "cancel";

const employeeName = (item: OvertimeRequest) =>
  [item.employee?.firstName, item.employee?.lastName].filter(Boolean).join(" ") ||
  item.employee?.employeeCode ||
  item.employeeId;

export function OvertimeWorkspace() {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission("hr.overtime.approve");
  const canManage = hasPermission("hr.overtime.manage");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OvertimeRequest | null>(null);
  const [mode, setMode] = useState<ProcessMode>("approve");
  const [sheetOpen, setSheetOpen] = useState(false);
  const query = useOvertimeRequests();
  const data = useMemo(
    () =>
      (query.data ?? []).filter((item) => {
        const term = search.trim().toLowerCase();
        return (
          !term ||
          employeeName(item).toLowerCase().includes(term) ||
          item.status.toLowerCase().includes(term)
        );
      }),
    [query.data, search],
  );

  const process = (request: OvertimeRequest, nextMode: ProcessMode) => {
    setSelected(request);
    setMode(nextMode);
    setSheetOpen(true);
  };

  const columns: ColumnDef<OvertimeRequest>[] = [
    {
      id: "employee",
      header: "Employee",
      cell: ({ row }) => employeeName(row.original),
    },
    {
      accessorKey: "businessDate",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.businessDate).toLocaleDateString(),
    },
    { accessorKey: "requestedMinutes", header: "Requested (min)" },
    { accessorKey: "eligibleMinutes", header: "Eligible (min)" },
    {
      accessorKey: "requestedSettlement",
      header: "Settlement",
      cell: ({ row }) => row.original.requestedSettlement ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge label={row.original.status} tone="neutral" />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const status = row.original.status.toUpperCase();
        const isSubmitted = status === "SUBMITTED";
        const isCalculated = status === "CALCULATED";
        return (
          <div className="flex flex-wrap items-center gap-1">
            {canApprove && isSubmitted ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => process(row.original, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => process(row.original, "reject")}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {canApprove && isCalculated ? (
              <span
                className="text-muted-foreground text-xs"
                title="Employee must submit from My Workspace first"
              >
                Waiting for employee submit
              </span>
            ) : null}
            {canManage && (isCalculated || isSubmitted) ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => process(row.original, "cancel")}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <WorkspaceShell>
      <p className="text-muted-foreground mb-3 text-sm">
        Flow: system <strong>CALCULATED</strong> → employee{" "}
        <Link className="underline" href="/my-workspace">
          My Workspace
        </Link>{" "}
        submits → status <strong>SUBMITTED</strong> → you Approve / Reject. Comp-off
        credits:{" "}
        <Link className="underline" href="/hr/leave/comp-off">
          Leave → Comp-off
        </Link>
        .
      </p>
      <PageToolbar>
        <Input
          className="max-w-sm"
          placeholder="Search employee or status…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </PageToolbar>
      <DataTable
        columns={columns}
        data={data}
        isLoading={query.isLoading}
        error={
          query.error
            ? getApiErrorMessage(query.error, "Could not load overtime requests.")
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No overtime requests"
        emptyDescription="After attendance overtime is calculated, employees submit from My Workspace, then Approve appears here."
        enablePagination
        pageSize={10}
      />
      <OvertimeProcessSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        request={selected}
        mode={mode}
      />
    </WorkspaceShell>
  );
}
