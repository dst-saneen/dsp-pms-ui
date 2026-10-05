"use client";

import { FileText } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";

import { useMyPayslips, usePayslipDownloadGrant } from "@/features/payroll/hooks";
import { formatMoney, formatPeriod } from "@/features/payroll/lib/format";

export function MyPayslipsCard({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: capabilities, isLoading: capabilitiesLoading } = useModuleCapabilities();
  const canViewPayslips = Boolean(capabilities?.payroll && capabilities.payrollNav);
  const query = useMyPayslips(canViewPayslips);
  const download = usePayslipDownloadGrant();

  if (capabilitiesLoading) {
    return (
      <div className="space-y-3" aria-label="Loading payslips">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!canViewPayslips) {
    return null;
  }

  return (
    <Card
      className={cn(
        embedded &&
          "gap-0 overflow-visible border-0 bg-transparent py-0 shadow-none [--card-spacing:--spacing(0)]"
      )}
    >
      {!embedded ? (
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Payslips
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
        </CardHeader>
      ) : null}
      <CardContent className={cn("space-y-3", embedded && "px-0")}>
        {query.isLoading ? (
          <div className="space-y-3" aria-label="Loading payslips">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : query.error ? (
          <div className="border-destructive/15 bg-danger-soft/40 flex items-center justify-between gap-3 rounded-md border px-3 py-3">
            <p className="text-destructive text-sm">
              {getApiErrorMessage(query.error, "Could not load payslips.")}
            </p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (query.data ?? []).length ? (
          query.data?.map((payslip) => (
            <div
              key={payslip.id}
              className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {formatPeriod(
                    payslip.payrollYear ?? payslip.year,
                    payslip.payrollMonth ?? payslip.month
                  )}
                  {payslip.runNumber ? ` · ${payslip.runNumber}` : ""}
                </p>
                <p className="text-muted-foreground text-sm">
                  Net {formatMoney(payslip.netSalary, payslip.currencyCode)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={payslip.status} tone="neutral" />
                {payslip.status === "PENDING" || payslip.status === "GENERATING" ? (
                  <p className="text-muted-foreground text-xs">
                    Payslip generation is in progress. Refresh shortly.
                  </p>
                ) : null}
                {payslip.status === "FAILED" ? (
                  <p className="text-muted-foreground text-xs">
                    Payslip generation failed. Contact payroll operations if this persists.
                  </p>
                ) : null}
                {payslip.status === "AVAILABLE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={download.isPending}
                    onClick={async () => {
                      const grant = await download.mutateAsync(payslip.id);
                      window.open(grant.downloadUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Download
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-muted/30 flex items-center gap-3 rounded-md px-3 py-3">
            <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 flex size-9 shrink-0 items-center justify-center rounded-md">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">No payslips available</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Payslips appear here after payroll is marked paid.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
