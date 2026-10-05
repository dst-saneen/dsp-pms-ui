"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search } from "lucide-react";

import { AdminStructureReadiness } from "@/features/administration/components/admin-structure-readiness";
import { FilterPanel } from "@/components/common/filter-panel";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import { getApiErrorMessage } from "@/services/api-client";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";

import { BranchToolbar } from "./branch-toolbar";
import { BranchTable } from "./branch-table";
import { BranchWorkingDaysSheet } from "../dialogs/branch-working-days-sheet";
import {
  branchCreateHref,
  branchEditHref,
} from "../lib/branch-navigation";
import { useBranches } from "../hooks/use-branches";
import type { Branch } from "../types/branch";

export function BranchWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.branches.manage");

  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: branches = [], refetch, isFetching, isLoading, error } =
    useBranches(companyId || undefined);

  const filteredBranches = useMemo(() => {
    const keyword = search.toLowerCase();

    return branches.filter(
      (branch) =>
        branch.branchCode.toLowerCase().includes(keyword) ||
        branch.branchName.toLowerCase().includes(keyword) ||
        (branch.company?.companyName ?? "").toLowerCase().includes(keyword),
    );
  }, [branches, search]);

  useEffect(() => {
    const workingDaysId = searchParams.get("workingDays");
    if (!workingDaysId || isLoading) return;
    const match = branches.find((branch) => branch.id === workingDaysId);
    if (!match) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setSelectedBranch(match);
      setCalendarOpen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [branches, isLoading, searchParams]);

  return (
    <WorkspaceShell>
      <AdminStructureReadiness />

      <KpiGrid columns={2}>
        <KpiCard
          title="Total Branches"
          value={isLoading ? "—" : branches.length}
          icon={MapPin}
          helperText="For the selected filters"
          density="compact"
        />
        <KpiCard
          title="Search Results"
          value={isLoading ? "—" : filteredBranches.length}
          icon={Search}
          helperText={
            search ? "Matching the current search" : "All branches shown"
          }
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <FilterPanel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <div className="space-y-2">
            <RequiredLabel>Company</RequiredLabel>
            <LookupSelect
              value={companyId}
              onChange={setCompanyId}
              items={companies}
              placeholder="All companies"
              loading={companiesLoading}
              clearable
              clearLabel="All companies"
            />
          </div>
        </div>
      </FilterPanel>

      <BranchToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={
          canManage
            ? () =>
                router.push(
                  branchCreateHref({
                    companyId: companyId || undefined,
                  }),
                )
            : undefined
        }
        onRefresh={() => refetch()}
        refreshing={isFetching}
      />

      <BranchTable
        data={filteredBranches}
        onEdit={(branch) => router.push(branchEditHref(branch.id))}
        onConfigureCalendar={(branch) => {
          setSelectedBranch(branch);
          setCalendarOpen(true);
        }}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load branches.")
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />

      <BranchWorkingDaysSheet
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        branch={selectedBranch}
      />
    </WorkspaceShell>
  );
}
