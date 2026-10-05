"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";

import { usePayrollDashboard } from "../hooks";
import { PayrollService } from "../service";
import { formatMoney, formatPeriod } from "../lib/format";

export function PayrollReportsTab() {
  const query = usePayrollDashboard();
  const { data: capabilities } = useModuleCapabilities();
  const [registerPending, setRegisterPending] = useState(false);

  if (query.isLoading) {
    return <div className="bg-muted/40 h-32 animate-pulse rounded-xl" />;
  }

  if (query.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(query.error, "Could not load payroll dashboard.")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) return null;

  const latestRun = data.recentRuns[0] ?? null;
  const canExportRegister = capabilities?.payrollActions?.includes("EXPORT_REGISTER") ?? false;

  async function downloadLatestRegister() {
    if (!latestRun) return;
    setRegisterPending(true);
    try {
      await PayrollService.downloadRegisterCsv(latestRun.id);
      toast.success("Register download started.");
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Unable to download register."));
    } finally {
      setRegisterPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Operational summary</h2>
        <p className="text-muted-foreground text-sm">
          High-level payroll KPIs for paid runs. This is an operational snapshot, not a statutory
          report pack.
        </p>
      </div>

      <KpiGrid columns={3}>
        <KpiCard title="Paid runs" value={data.paidSummary.runCount} tone="information" />
        <KpiCard
          title="Total net paid"
          value={formatMoney(data.paidSummary.totals.net)}
          tone="success"
        />
        <KpiCard
          title="Latest run"
          value={latestRun ? formatPeriod(latestRun.year, latestRun.month) : "—"}
          helperText={latestRun?.status}
          tone="accent"
        />
      </KpiGrid>

      {latestRun ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest run register</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground text-sm">
              {latestRun.runNumber} · {formatPeriod(latestRun.year, latestRun.month)} ·{" "}
              {latestRun.status}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/hr/payroll/runs/${latestRun.id}`}>Open run</Link>
            </Button>
            {canExportRegister ? (
              <Button
                size="sm"
                variant="outline"
                disabled={registerPending}
                onClick={() => void downloadLatestRegister()}
              >
                {registerPending ? "Downloading…" : "Download register CSV"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
