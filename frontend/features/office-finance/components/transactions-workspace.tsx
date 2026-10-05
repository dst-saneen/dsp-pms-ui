"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
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
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";

import { useFinanceTransactions } from "../hooks";
import type { FinanceTransaction } from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { CreateTransactionDialog } from "./create-transaction-dialog";
import { OfficeFinancePathBanner } from "./office-finance-path-banner";

const STATUS_VALUES = ["all", "DRAFT", "SUBMITTED", "APPROVED", "CANCELLED", "REVERSED"] as const;

function initialStatusFor(statusParam: string | null | undefined) {
  const normalizedStatus = statusParam?.toUpperCase();
  return normalizedStatus && (STATUS_VALUES as readonly string[]).includes(normalizedStatus)
    ? normalizedStatus
    : "all";
}

function TransactionsWorkspaceInner({ initialStatus }: { initialStatus: string }) {
  const { data: capabilities } = useModuleCapabilities();
  const canCreateTransaction =
    capabilities?.financeActions?.includes("CREATE_TRANSACTION") ?? false;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(initialStatus);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useFinanceTransactions({
    keyword: search.trim() || undefined,
    status: status === "all" ? undefined : status,
    page: 1,
    limit: 50,
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const columns: ColumnDef<FinanceTransaction>[] = [
    {
      accessorKey: "transactionNumber",
      header: "Number",
      cell: ({ row }) => (
        <Link
          href={`/office-finance/transactions/${row.original.id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.original.transactionNumber}
        </Link>
      ),
    },
    {
      accessorKey: "transactionDate",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.transactionDate),
    },
    {
      accessorKey: "transactionType",
      header: "Type",
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.description}</span>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatMoney(row.original.amount, row.original.currencyCode),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge label={row.original.status} tone="neutral" />,
    },
  ];

  return (
    <WorkspaceShell>
      <OfficeFinancePathBanner
        current="transactions"
        note="After Setup: Create → Submit → Approve. Optional fields can stay None."
      />
      <PageToolbar>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            aria-label="Search transactions"
            placeholder="Search transactions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-xs"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter transactions by status" className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REVERSED">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {canCreateTransaction ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              New transaction
            </Button>
          ) : null}
        </div>
      </PageToolbar>
      {!canCreateTransaction ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You do not have permission to create transactions. You can still open rows you can see.
          Complete{" "}
          <Link href="/office-finance/setup" className="underline">
            Setup
          </Link>{" "}
          first if the list is empty for everyone.
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error, "Could not load transactions.") : null}
        onRetry={() => void query.refetch()}
        emptyTitle="No transactions"
        emptyDescription="Create a transaction after Setup (profile, parties, categories, accounts, open period)."
        enablePagination
        pageSize={10}
      />
      {rows.length === 0 && !query.isLoading && !query.error ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/office-finance/setup">Go to Setup</Link>
          </Button>
          {canCreateTransaction ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create transaction
            </Button>
          ) : null}
        </div>
      ) : null}

      <CreateTransactionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </WorkspaceShell>
  );
}

function TransactionsWorkspaceQueryState() {
  const searchParams = useSearchParams();
  const initialStatus = initialStatusFor(searchParams?.get("status"));

  return <TransactionsWorkspaceInner key={initialStatus} initialStatus={initialStatus} />;
}

export function TransactionsWorkspace() {
  return (
    <Suspense fallback={<div className="bg-muted/40 h-40 animate-pulse rounded-xl" />}>
      <TransactionsWorkspaceQueryState />
    </Suspense>
  );
}
