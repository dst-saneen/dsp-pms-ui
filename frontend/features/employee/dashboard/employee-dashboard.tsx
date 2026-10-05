"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, UserCheck, UserMinus, UsersRound } from "lucide-react";

import { FilterPanel } from "@/components/common/filter-panel";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProbationQueueWorkspace,
  RecruitCandidateDialog,
} from "@/features/employee-career";
import { useBranches } from "@/features/branch/hooks/use-branches";
import { useDepartments } from "@/features/department/hooks/use-departments";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { InternalApplicationDialog } from "@/features/recruitment/applications/dialogs/internal-application-dialog";
import { RECRUITMENT_PERMISSIONS } from "@/features/recruitment/constants/permissions";
import { RECRUITMENT_ROUTES } from "@/features/recruitment/constants/routes";
import { useAuth } from "@/providers/auth-provider";

import { EmployeeToolbar } from "./employee-toolbar";
import { EmployeeTable } from "./employee-table";
import { useEmployeeSummary } from "../hooks/use-employee-summary";
import {
  employeeCreateHref,
  employeeDirectoryHref,
  parseEmployeeDirectoryFilters,
  type EmployeeDirectoryFilters,
} from "../lib/employee-navigation";

const STATUS_OPTIONS = [
  { id: "ACTIVE", name: "Active" },
  { id: "PROBATION", name: "Probation" },
  { id: "PENDING_ONBOARDING", name: "Pending onboarding" },
  { id: "NOTICE", name: "Notice" },
  { id: "TERMINATED", name: "Terminated" },
  { id: "RESIGNED", name: "Resigned" },
];

function EmployeeDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canAddEmployee = hasPermission("hr.employees.manage");
  const canInternalEntry = hasPermission(RECRUITMENT_PERMISSIONS.manage);

  const filters = useMemo(
    () => parseEmployeeDirectoryFilters(searchParams),
    [searchParams],
  );

  const [recruitOpen, setRecruitOpen] = useState(false);
  const [internalEntryOpen, setInternalEntryOpen] = useState(false);

  const listHref = employeeDirectoryHref(filters);

  const replaceFilters = useCallback(
    (next: EmployeeDirectoryFilters) => {
      router.replace(employeeDirectoryHref(next));
    },
    [router],
  );

  const commitSearch = useCallback(
    (search: string) => {
      if (search === filters.search) return;
      replaceFilters({ ...filters, search, page: 1 });
    },
    [filters, replaceFilters],
  );

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: branches = [], isLoading: branchesLoading } = useBranches(
    filters.companyId || undefined,
  );
  const { data: departments = [], isLoading: departmentsLoading } =
    useDepartments(
      filters.branchId || undefined,
      filters.companyId || undefined,
    );

  const branchItems = useMemo(
    () =>
      branches.map((branch) => ({
        id: branch.id,
        code: branch.branchCode,
        name: branch.branchName,
      })),
    [branches],
  );

  const departmentItems = useMemo(
    () =>
      departments.map((department) => ({
        id: department.id,
        code: department.departmentCode,
        name: department.departmentName,
      })),
    [departments],
  );

  const { data: summary = [], isLoading: summaryLoading } = useEmployeeSummary();

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employees"] }),
      queryClient.invalidateQueries({ queryKey: ["employee-summary"] }),
    ]);
  };

  const summaryVisuals = [
    { icon: UsersRound, tone: "accent" },
    { icon: UserCheck, tone: "success" },
    { icon: UserMinus, tone: "neutral" },
    { icon: Building2, tone: "information" },
  ] as const;

  return (
    <WorkspaceShell>
      <p className="text-sm text-muted-foreground">
        Manage employee records. Use{" "}
        <span className="font-medium text-foreground">Add Employee</span> for
        people already hired. New hires go through{" "}
        <span className="font-medium text-foreground">Recruit Candidate</span>.
      </p>

      <KpiGrid columns={4}>
        {summaryLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="gap-0 py-0">
                <CardContent className="flex min-h-32 flex-col justify-between gap-4 p-5">
                  <Skeleton className="h-4 w-24" />
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))
          : summary.map((item, index) => (
              <KpiCard
                key={item.key}
                title={item.label}
                value={item.value}
                icon={summaryVisuals[index % summaryVisuals.length].icon}
                tone={summaryVisuals[index % summaryVisuals.length].tone}
                helperText="Current employee records"
                density="compact"
              />
            ))}
      </KpiGrid>

      <FilterPanel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:gap-6">
          <div className="space-y-2">
            <RequiredLabel>Company</RequiredLabel>
            <LookupSelect
              value={filters.companyId}
              onChange={(value) =>
                replaceFilters({
                  ...filters,
                  companyId: value,
                  branchId: "",
                  departmentId: "",
                  page: 1,
                })
              }
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
              value={filters.branchId}
              onChange={(value) =>
                replaceFilters({
                  ...filters,
                  branchId: value,
                  departmentId: "",
                  page: 1,
                })
              }
              items={branchItems}
              placeholder={
                filters.companyId ? "All branches" : "Select company first"
              }
              loading={branchesLoading}
              disabled={!filters.companyId}
              clearable
              clearLabel="All branches"
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel>Department</RequiredLabel>
            <LookupSelect
              value={filters.departmentId}
              onChange={(value) =>
                replaceFilters({
                  ...filters,
                  departmentId: value,
                  page: 1,
                })
              }
              items={departmentItems}
              placeholder={
                filters.branchId || filters.companyId
                  ? "All departments"
                  : "Select company first"
              }
              loading={departmentsLoading}
              disabled={!filters.companyId && !filters.branchId}
              clearable
              clearLabel="All departments"
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel>Status</RequiredLabel>
            <LookupSelect
              value={filters.employmentStatus}
              onChange={(value) =>
                replaceFilters({
                  ...filters,
                  employmentStatus: value,
                  page: 1,
                })
              }
              items={STATUS_OPTIONS}
              placeholder="All statuses"
              clearable
              clearLabel="All statuses"
            />
          </div>
        </div>
      </FilterPanel>

      <EmployeeSearchToolbar
        key={filters.search}
        initialSearch={filters.search}
        onSearchCommitted={commitSearch}
        onRecruit={() => setRecruitOpen(true)}
        onAddEmployee={() => router.push(employeeCreateHref(listHref))}
        showAddEmployee={canAddEmployee}
        onInternalEntry={() => setInternalEntryOpen(true)}
        showInternalEntry={canInternalEntry}
        onRefresh={handleRefresh}
      />

      <EmployeeTable
        filters={filters}
        listHref={listHref}
        onPageChange={(page) => replaceFilters({ ...filters, page })}
      />

      <ProbationQueueWorkspace />

      <RecruitCandidateDialog open={recruitOpen} onOpenChange={setRecruitOpen} />

      <InternalApplicationDialog
        open={internalEntryOpen}
        onOpenChange={setInternalEntryOpen}
        onCreated={(applicationId) => {
          router.push(RECRUITMENT_ROUTES.applications.detail(applicationId));
        }}
      />
    </WorkspaceShell>
  );
}

function EmployeeSearchToolbar({
  initialSearch,
  onSearchCommitted,
  onRecruit,
  onAddEmployee,
  showAddEmployee,
  onInternalEntry,
  showInternalEntry,
  onRefresh,
}: {
  initialSearch: string;
  onSearchCommitted: (search: string) => void;
  onRecruit: () => void;
  onAddEmployee?: () => void;
  showAddEmployee?: boolean;
  onInternalEntry?: () => void;
  showInternalEntry?: boolean;
  onRefresh: () => void;
}) {
  const [searchDraft, setSearchDraft] = useState(initialSearch);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      onSearchCommitted(searchDraft);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [onSearchCommitted, searchDraft]);

  return (
    <EmployeeToolbar
      onRecruit={onRecruit}
      onAddEmployee={onAddEmployee}
      showAddEmployee={showAddEmployee}
      onInternalEntry={onInternalEntry}
      showInternalEntry={showInternalEntry}
      onRefresh={onRefresh}
      search={searchDraft}
      onSearchChange={setSearchDraft}
    />
  );
}

export function EmployeeDashboard() {
  return (
    <Suspense
      fallback={
        <WorkspaceShell>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </WorkspaceShell>
      }
    >
      <EmployeeDashboardContent />
    </Suspense>
  );
}
