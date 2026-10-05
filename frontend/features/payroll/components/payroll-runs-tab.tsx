"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";

import { usePayrollRuns } from "../hooks";
import type { PayrollRun } from "../types";
import { formatMoney, formatPeriod } from "../lib/format";
import { formatPayrollRunStatus } from "../lib/payroll-run-status";
import { CreateRunDialog } from "./create-run-dialog";

export function PayrollRunsTab() {
  const { data: capabilities } = useModuleCapabilities();
  const canCreateRun =
    capabilities?.payrollActions?.includes("CREATE_RUN") ?? false;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const query = usePayrollRuns({ page, limit });
  const [createOpen, setCreateOpen] = useState(false);
  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / limit));
  let pageSummary = `Page ${page} · ${query.error ? "Unable to load runs" : "Loading runs…"}`;
  if (query.data) {
    pageSummary =
      page > totalPages
        ? `Page ${page} is no longer available · ${query.data.total} total`
        : `Page ${query.data.page} of ${totalPages} · ${query.data.total} total`;
  }

  const columns: ColumnDef<PayrollRun>[] = [
    {
      accessorKey: "runNumber",
      header: "Run",
      cell: ({ row }) => (
        <Link
          href={`/hr/payroll/runs/${row.original.id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.original.runNumber}
        </Link>
      ),
    },
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => formatPeriod(row.original.year, row.original.month),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={formatPayrollRunStatus(row.original.status)}
          tone="neutral"
        />
      ),
    },
    {
      id: "net",
      header: "Net",
      cell: ({ row }) =>
        formatMoney(row.original.totals.net, row.original.currencyCode),
    },
  ];

  return (
    <>
      <PageToolbar>
        <span className="text-muted-foreground text-sm">
          Monthly payroll runs.
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {canCreateRun ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              New run
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              title="Needs payroll manage permission to create runs."
            >
              <Plus className="mr-1 size-4" />
              New run
            </Button>
          )}
        </div>
      </PageToolbar>
      {!canCreateRun ? (
        <p className="text-muted-foreground mb-3 text-xs">
          New run is disabled without payroll manage. Finish{" "}
          <Link href="/hr/payroll?tab=components" className="underline">
            Salary Components
          </Link>{" "}
          and{" "}
          <Link href="/hr/payroll?tab=salaries" className="underline">
            Employee Salaries
          </Link>{" "}
          first if the list is empty for everyone.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isLoading}
        error={
          query.error
            ? getApiErrorMessage(query.error, "Could not load payroll runs.")
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle={page > 1 ? "No runs on this page" : "No payroll runs"}
        emptyDescription={
          page > 1
            ? "Return to the previous page to view payroll runs."
            : "Create a run after salary components and employee salary revisions exist."
        }
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{pageSummary}</p>
        <div className="flex items-center gap-2">
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              setLimit(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[110px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!query.data || page >= totalPages || query.isFetching}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </div>
      {page === 1 && query.data?.total === 0 && !query.isLoading && !query.error ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/hr/payroll?tab=components">Salary Components</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/hr/payroll?tab=salaries">Employee Salaries</Link>
          </Button>
          {canCreateRun ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New run
            </Button>
          ) : null}
        </div>
      ) : null}
      <CreateRunDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
