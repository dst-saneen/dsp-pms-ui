"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
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
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";
import { OfficeFinanceService } from "../service";

import { useFinanceReports } from "../hooks";
import type {
  FinanceAccountBalanceRow,
  FinanceAccountMovementRow,
  FinanceReportFilters,
  FinanceReportGroupRow,
  FinanceReportSummary,
} from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { OfficeFinancePathBanner } from "./office-finance-path-banner";

const reportOptions = [
  { value: "summary", label: "Income and Expense Summary" },
  { value: "by-category", label: "Category Summary" },
  { value: "by-department", label: "Department Summary" },
  { value: "by-project", label: "Project Summary" },
  { value: "account-movements", label: "Cash Movement" },
  { value: "account-balance", label: "Account Balance" },
] as const;

type ReportType = (typeof reportOptions)[number]["value"];

export function ReportsWorkspace() {
  const { data: capabilities } = useModuleCapabilities();
  const canExport =
    capabilities?.financeActions?.includes("EXPORT_REPORT") ?? false;
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [filters, setFilters] = useState<FinanceReportFilters>({});
  const [draftFilters, setDraftFilters] = useState<FinanceReportFilters>({});

  const query = useFinanceReports(filters, reportType);

  const groupColumns: ColumnDef<FinanceReportGroupRow>[] = [
    { accessorKey: "label", header: "Name" },
    {
      accessorKey: "income",
      header: "Income",
      cell: ({ row }) => formatMoney(row.original.income),
    },
    {
      accessorKey: "expense",
      header: "Expense",
      cell: ({ row }) => formatMoney(row.original.expense),
    },
    {
      accessorKey: "net",
      header: "Net",
      cell: ({ row }) => formatMoney(row.original.net),
    },
  ];

  const movementColumns: ColumnDef<FinanceAccountMovementRow>[] = [
    { accessorKey: "transactionNumber", header: "Number" },
    {
      accessorKey: "transactionDate",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.transactionDate),
    },
    { accessorKey: "transactionType", header: "Type" },
    { accessorKey: "status", header: "Status" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    {
      accessorKey: "runningBalance",
      header: "Balance",
      cell: ({ row }) => formatMoney(row.original.runningBalance),
    },
  ];

  const balanceColumns: ColumnDef<FinanceAccountBalanceRow>[] = [
    { accessorKey: "accountCode", header: "Code" },
    { accessorKey: "accountName", header: "Account" },
    { accessorKey: "accountType", header: "Type" },
    {
      accessorKey: "projectedBalance",
      header: "Balance",
      cell: ({ row }) =>
        formatMoney(row.original.projectedBalance, row.original.currencyCode),
    },
    {
      accessorKey: "asOf",
      header: "As of",
      cell: ({ row }) => formatDate(row.original.asOf.slice(0, 10)),
    },
  ];

  const summary = query.data as FinanceReportSummary | undefined;
  const groupRows = useMemo(
    () => (Array.isArray(query.data) ? (query.data as FinanceReportGroupRow[]) : []),
    [query.data],
  );
  const movementRows = useMemo(
    () =>
      Array.isArray(query.data) ? (query.data as FinanceAccountMovementRow[]) : [],
    [query.data],
  );
  const balanceRows = useMemo(
    () =>
      Array.isArray(query.data) ? (query.data as FinanceAccountBalanceRow[]) : [],
    [query.data],
  );

  return (
    <WorkspaceShell>
      <OfficeFinancePathBanner
        current="reports"
        note="Reports need Approved (or posted) activity. If empty, finish Setup and record transactions first."
      />
      <PageToolbar>
        <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canExport ? (
          <Button
            variant="outline"
            onClick={() => void OfficeFinanceService.exportCsv(filters)}
          >
            Export CSV
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            title="Needs finance.reports.export permission."
          >
            Export CSV
          </Button>
        )}
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </PageToolbar>
      {!canExport ? (
        <p className="text-muted-foreground mb-3 text-xs">
          Export CSV is disabled without export permission. You can still view
          on-screen reports.
        </p>
      ) : null}

      {reportType !== "account-balance" ? (
        <div className="border-border bg-card mb-4 space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="font-medium">Filters</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDraftFilters({});
                  setFilters({});
                }}
              >
                Reset
              </Button>
              <Button onClick={() => setFilters(draftFilters)}>Apply</Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                type="date"
                value={draftFilters.fromDate ?? ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    fromDate: event.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To</Label>
              <Input
                id="toDate"
                type="date"
                value={draftFilters.toDate ?? ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    toDate: event.target.value || undefined,
                  }))
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {reportType === "summary" && summary ? (
        <KpiGrid columns={3}>
          <KpiCard title="Income" value={formatMoney(summary.totalIncome)} tone="success" />
          <KpiCard title="Expense" value={formatMoney(summary.totalExpense)} tone="danger" />
          <KpiCard title="Net" value={formatMoney(summary.net)} tone="information" />
        </KpiGrid>
      ) : null}

      {reportType === "account-balance" ? (
        <DataTable
          columns={balanceColumns}
          data={balanceRows}
          isLoading={query.isLoading}
          error={
            query.error
              ? getApiErrorMessage(query.error, "Could not load report.")
              : null
          }
          onRetry={() => void query.refetch()}
          emptyTitle="No payment accounts"
          emptyDescription="Add payment accounts in Setup to see balances."
          enablePagination
          pageSize={10}
        />
      ) : reportType === "account-movements" ? (
        <DataTable
          columns={movementColumns}
          data={movementRows}
          isLoading={query.isLoading}
          error={
            query.error
              ? getApiErrorMessage(query.error, "Could not load report.")
              : null
          }
          onRetry={() => void query.refetch()}
          emptyTitle="No report data"
          emptyDescription="Adjust filters or record transactions for this period."
          enablePagination
          pageSize={10}
        />
      ) : reportType !== "summary" ? (
        <DataTable
          columns={groupColumns}
          data={groupRows}
          isLoading={query.isLoading}
          error={
            query.error
              ? getApiErrorMessage(query.error, "Could not load report.")
              : null
          }
          onRetry={() => void query.refetch()}
          emptyTitle="No report data"
          emptyDescription="Adjust filters or record transactions for this period."
          enablePagination
          pageSize={10}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/office-finance/setup">Setup</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/office-finance/transactions">Transactions</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/office-finance">Dashboard</Link>
          </Button>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
