"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { GenerateLeaveBalancesSheet } from "../dialogs/generate-leave-balances-sheet";
import { useEmployeeLeaveBalances } from "../hooks/use-employee-leave-balances";
import { groupLeaveBalancesByEmployee } from "../lib/group-leave-balances";
import type { EmployeeLeaveBalanceGroup } from "../types/leave-balance";

function formatDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function EmployeeBalanceRow({ group }: { group: EmployeeLeaveBalanceGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="hover:bg-muted/40 flex w-full items-start gap-3 px-3 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-muted-foreground mt-0.5">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium">{group.employeeName}</span>
            <span className="text-muted-foreground text-xs">
              {group.employeeCode}
            </span>
          </span>
          <span className="text-muted-foreground block text-xs">
            {group.designationName} · {group.branchName} · {group.companyName}
          </span>
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {group.balances.length} leave type
          {group.balances.length === 1 ? "" : "s"} · available{" "}
          {formatDays(group.totals.available)}
        </span>
      </button>

      {open ? (
        <div className="border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-3 py-2 font-medium">Leave type</th>
                <th className="px-3 py-2 font-medium">Entitlement</th>
                <th className="px-3 py-2 font-medium">Used</th>
                <th className="px-3 py-2 font-medium">Pending</th>
                <th className="px-3 py-2 font-medium">Available</th>
              </tr>
            </thead>
            <tbody>
              {group.balances.map((balance) => (
                <tr key={balance.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block">
                      {balance.leaveType?.leaveName ?? "—"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {balance.leaveType?.leaveCode}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {formatDays(Number(balance.entitlement))}
                  </td>
                  <td className="px-3 py-2">
                    {formatDays(Number(balance.used))}
                  </td>
                  <td className="px-3 py-2">
                    {formatDays(Number(balance.pending))}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {formatDays(Number(balance.balance))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function EmployeeLeaveBalanceWorkspace() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("hr.leave.manage");
  const companiesQuery = useCompanies();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [companyId, setCompanyId] = useState(
    () => user?.authorization.activeCompanyId ?? "",
  );
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);

  const companyItems = companiesQuery.data ?? [];
  const resolvedCompanyId =
    companyId ||
    (companyItems.length === 1 ? companyItems[0].id : "") ||
    user?.authorization.activeCompanyId ||
    "";

  const branchesQuery = useBranches(resolvedCompanyId || undefined);
  const filters = {
    year,
    companyId: resolvedCompanyId || undefined,
    branchId: branchId || undefined,
  };
  const balancesQuery = useEmployeeLeaveBalances(filters);

  const groups = useMemo(() => {
    const all = groupLeaveBalancesByEmployee(balancesQuery.data ?? []);
    const keyword = search.trim().toLowerCase();
    if (!keyword) return all;
    return all.filter(
      (group) =>
        group.employeeName.toLowerCase().includes(keyword) ||
        group.employeeCode.toLowerCase().includes(keyword) ||
        group.designationName.toLowerCase().includes(keyword),
    );
  }, [balancesQuery.data, search]);

  return (
    <WorkspaceShell>
      <p className="text-muted-foreground text-sm">
        Employees in your scope and their leave balances for the selected year.
        Expand a person to see each leave type.
      </p>

      <KpiGrid columns={2}>
        <KpiCard
          title="Employees"
          value={balancesQuery.isLoading ? "—" : groups.length}
          icon={Users}
          helperText={year ? `Year ${year}` : "Select year"}
          density="compact"
        />
        <KpiCard
          title="Balance rows"
          value={
            balancesQuery.isLoading
              ? "—"
              : (balancesQuery.data?.length ?? 0)
          }
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex w-full flex-wrap items-end gap-2">
          <div className="w-28 space-y-1">
            <Label
              htmlFor="leave-balance-year"
              className="text-muted-foreground text-xs"
            >
              Year
            </Label>
            <Input
              id="leave-balance-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number(event.target.value) || year)}
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <Label
              htmlFor="leave-balance-company"
              className="text-muted-foreground text-xs"
            >
              Company
            </Label>
            <LookupSelect
              id="leave-balance-company"
              value={resolvedCompanyId}
              onChange={(value) => {
                setCompanyId(value);
                setBranchId("");
              }}
              items={companyItems}
              loading={companiesQuery.isLoading}
              placeholder="Select company"
              clearable={false}
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <Label
              htmlFor="leave-balance-branch"
              className="text-muted-foreground text-xs"
            >
              Branch
            </Label>
            <LookupSelect
              id="leave-balance-branch"
              value={branchId}
              onChange={setBranchId}
              items={branchesQuery.data ?? []}
              loading={branchesQuery.isLoading}
              placeholder="All branches"
              disabled={!resolvedCompanyId}
              clearable
            />
          </div>
          <div className="max-w-sm space-y-1">
            <Label htmlFor="leave-balance-search" className="sr-only">
              Search employees
            </Label>
            <Input
              id="leave-balance-search"
              placeholder="Search employee…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void balancesQuery.refetch()}
              disabled={balancesQuery.isFetching}
            >
              {balancesQuery.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            {canManage ? (
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(true)}>
                Generate balances
              </Button>
            ) : null}
          </div>
        </div>
      </PageToolbar>

      {balancesQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading employee leave balances…</p>
      ) : balancesQuery.error ? (
        <div className="space-y-2">
          <p className="text-destructive text-sm">
            {getApiErrorMessage(
              balancesQuery.error,
              "Could not load employee leave balances.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void balancesQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <p className="font-medium">No employee leave balances</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {canManage
              ? "Generate balances from policies, or adjust year / company filters."
              : "No balances in your scope for this year."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <EmployeeBalanceRow key={group.employeeId} group={group} />
          ))}
        </div>
      )}

      <GenerateLeaveBalancesSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />
    </WorkspaceShell>
  );
}
