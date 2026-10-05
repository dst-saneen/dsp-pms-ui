"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Network, Search } from "lucide-react";

import { AdminStructureReadiness } from "@/features/administration/components/admin-structure-readiness";
import { FilterPanel } from "@/components/common/filter-panel";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import { DepartmentToolbar } from "./department-toolbar";
import { DepartmentTable } from "./department-table";
import {
  departmentCreateHref,
  departmentEditHref,
} from "../lib/department-navigation";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useBranches } from "@/features/branch/hooks/use-branches";
import { useDepartments } from "../hooks/use-departments";

export function DepartmentWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.structure.manage");

  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: branches = [], isLoading: branchesLoading } = useBranches(
    companyId || undefined,
  );

  const {
    data: departments = [],
    refetch,
    isFetching,
    isLoading,
    error,
  } = useDepartments(branchId || undefined, companyId || undefined);

  const filteredDepartments = useMemo(() => {
    const keyword = search.toLowerCase();

    return departments.filter(
      (department) =>
        department.departmentCode.toLowerCase().includes(keyword) ||
        department.departmentName.toLowerCase().includes(keyword) ||
        (department.company?.companyName ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (department.branch?.branchName ?? "").toLowerCase().includes(keyword),
    );
  }, [departments, search]);

  return (
    <WorkspaceShell>
      <AdminStructureReadiness />

      <KpiGrid columns={2}>
        <KpiCard
          title="Total Departments"
          value={isLoading ? "—" : departments.length}
          icon={Network}
          helperText="For the selected filters"
          density="compact"
        />
        <KpiCard
          title="Search Results"
          value={isLoading ? "—" : filteredDepartments.length}
          icon={Search}
          helperText={
            search ? "Matching the current search" : "All departments shown"
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
              onChange={(value) => {
                setCompanyId(value);
                setBranchId("");
              }}
              items={companies}
              placeholder="All companies"
              loading={companiesLoading}
              clearable
              clearLabel="All companies"
            />
          </div>

          <div className="space-y-2">
            <RequiredLabel>Branch</RequiredLabel>
            <LookupSelect
              value={branchId}
              onChange={setBranchId}
              items={branches.map((branch) => ({
                id: branch.id,
                code: branch.branchCode,
                name: branch.branchName,
              }))}
              placeholder={
                companyId ? "All branches" : "Select company first (optional)"
              }
              loading={branchesLoading}
              disabled={!companyId}
              clearable
              clearLabel="All branches"
            />
          </div>
        </div>
      </FilterPanel>

      <DepartmentToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={
          canManage
            ? () =>
                router.push(
                  departmentCreateHref({
                    companyId: companyId || undefined,
                    branchId: branchId || undefined,
                  }),
                )
            : undefined
        }
        onRefresh={() => refetch()}
        refreshing={isFetching}
      />

      <DepartmentTable
        data={filteredDepartments}
        onEdit={(department) =>
          router.push(departmentEditHref(department.id))
        }
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load departments.")
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />
    </WorkspaceShell>
  );
}

/** Page wrapper when search params are needed elsewhere. */
export function DepartmentWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <DepartmentWorkspace />
    </Suspense>
  );
}
