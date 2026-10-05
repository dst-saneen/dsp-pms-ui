"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Clock3, Landmark, Scale } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/services/api-client";

import { useFinanceDashboard } from "../hooks";
import { formatDate, formatMoney } from "../lib/format";
import { OfficeFinancePathBanner } from "./office-finance-path-banner";

export function OfficeFinanceDashboard() {
  const query = useFinanceDashboard();

  if (query.isLoading) {
    return (
      <WorkspaceShell>
        <OfficeFinancePathBanner
          current="dashboard"
          note="Setup first (currency, parties, accounts, period), then record transactions. Dashboard summarises this month."
        />
        <KpiGrid columns={4}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-muted/40 h-32 animate-pulse rounded-xl"
            />
          ))}
        </KpiGrid>
      </WorkspaceShell>
    );
  }

  if (query.error) {
    return (
      <WorkspaceShell>
        <OfficeFinancePathBanner current="dashboard" />
        <ErrorState
          description={getApiErrorMessage(
            query.error,
            "Could not load finance dashboard.",
          )}
          onRetry={() => void query.refetch()}
        />
      </WorkspaceShell>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <WorkspaceShell>
        <OfficeFinancePathBanner
          current="dashboard"
          note="No summary yet. Configure Setup, then add transactions."
        />
        <EmptyState
          icon={Landmark}
          title="No dashboard data"
          description="Finance summary appears after Setup is complete and transactions are recorded."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/office-finance/setup">Go to Setup</Link>
          </Button>
          <Button asChild>
            <Link href="/office-finance/transactions">Transactions</Link>
          </Button>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <OfficeFinancePathBanner
        current="dashboard"
        note="Setup first → Transactions → Reports. This page is a month snapshot only."
      />
      <p className="text-muted-foreground text-sm">
        Summary for {formatDate(data.monthStart)} – {formatDate(data.monthEnd)} ·
        updated {formatDate(data.asOf.slice(0, 10))}
      </p>
      <KpiGrid columns={4}>
        <KpiCard
          title="Total income"
          value={formatMoney(data.totalIncome)}
          icon={ArrowDownLeft}
          tone="success"
        />
        <KpiCard
          title="Total expense"
          value={formatMoney(data.totalExpense)}
          icon={ArrowUpRight}
          tone="danger"
        />
        <KpiCard
          title="Net"
          value={formatMoney(data.net)}
          icon={Scale}
          tone="information"
        />
        <KpiCard
          title="Pending approval"
          value={data.pendingApproval}
          icon={Clock3}
          tone="warning"
          helperText={
            data.pendingApproval > 0
              ? "Open Transactions and filter Submitted to approve"
              : "Submitted transactions awaiting approval"
          }
        />
      </KpiGrid>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/office-finance/setup">Setup</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link
            href={
              data.pendingApproval > 0
                ? "/office-finance/transactions?status=SUBMITTED"
                : "/office-finance/transactions"
            }
          >
            Transactions
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/office-finance/reports">Reports</Link>
        </Button>
      </div>
    </WorkspaceShell>
  );
}
