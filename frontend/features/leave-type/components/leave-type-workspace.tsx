"use client";

import { useState } from "react";
import { CheckCircle2, Layers3, PauseCircle } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { LeaveTypeDialog } from "../dialogs/leave-type-dialog";
import { useLeaveTypes } from "../hooks/use-leave-types";
import type { LeaveType } from "../types/leave-type";
import { LeaveTypeTable } from "./leave-type-table";

export function LeaveTypeWorkspace() {
  const { user } = useAuth();
  const companiesQuery = useCompanies();
  const [companyId, setCompanyId] = useState(
    () => user?.authorization.activeCompanyId ?? "",
  );
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveType | null>(null);
  const [search, setSearch] = useState("");

  const companyItems = companiesQuery.data ?? [];

  const resolvedCompanyId =
    companyId ||
    (companyItems.length === 1 ? companyItems[0].id : "") ||
    user?.authorization.activeCompanyId ||
    "";

  const { data = [], refetch, isFetching, isLoading, error } = useLeaveTypes(
    resolvedCompanyId || undefined,
  );

  const selectedCompanyName =
    companyItems.find((item) => item.id === resolvedCompanyId)?.name ?? null;

  const filtered = data.filter((item) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return (
      item.leaveCode.toLowerCase().includes(keyword) ||
      item.leaveName.toLowerCase().includes(keyword)
    );
  });

  return (
    <WorkspaceShell>
      <p className="text-muted-foreground text-sm">
        Leave types belong to one company. Pick a company to view or add types
        for that company only.
      </p>

      <KpiGrid columns={3}>
        <KpiCard
          title="Leave types"
          value={!resolvedCompanyId || isLoading ? "—" : data.length}
          icon={Layers3}
          helperText={
            selectedCompanyName
              ? `For ${selectedCompanyName}`
              : "Select a company"
          }
          density="compact"
        />
        <KpiCard
          title="Paid"
          value={
            !resolvedCompanyId || isLoading
              ? "—"
              : data.filter((x) => x.isPaid).length
          }
          icon={CheckCircle2}
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Unpaid"
          value={
            !resolvedCompanyId || isLoading
              ? "—"
              : data.filter((x) => !x.isPaid).length
          }
          icon={PauseCircle}
          tone="neutral"
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex w-full flex-wrap items-end gap-2">
          <div className="w-full max-w-xs space-y-1">
            <p className="text-muted-foreground text-xs">Company</p>
            <LookupSelect
              value={resolvedCompanyId}
              onChange={setCompanyId}
              items={companyItems}
              loading={companiesQuery.isLoading}
              placeholder="Select company"
              clearable={false}
            />
          </div>
          <Input
            placeholder="Search code or name…"
            className="max-w-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!resolvedCompanyId}
          />
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={!resolvedCompanyId || isFetching}
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              disabled={!resolvedCompanyId}
              onClick={() => {
                setSelected(null);
                setOpen(true);
              }}
            >
              Add leave type
            </Button>
          </div>
        </div>
      </PageToolbar>

      <LeaveTypeTable
        data={filtered}
        companySelected={Boolean(resolvedCompanyId)}
        companyName={selectedCompanyName}
        onEdit={(item) => {
          setSelected(item);
          setOpen(true);
        }}
        isLoading={Boolean(resolvedCompanyId) && isLoading}
        error={
          error
            ? getApiErrorMessage(error, "Could not load leave types.")
            : null
        }
        onRetry={() => void refetch()}
      />

      <LeaveTypeDialog
        open={open}
        onOpenChange={setOpen}
        leaveType={selected}
        defaultCompanyId={resolvedCompanyId}
      />
    </WorkspaceShell>
  );
}
