"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CheckCircle2, PauseCircle } from "lucide-react";

import { FilterPanel } from "@/components/common/filter-panel";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import { AdminStructureReadiness } from "@/features/administration/components/admin-structure-readiness";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { DesignationToolbar } from "./designation-toolbar";
import { DesignationTable } from "./designation-table";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useDesignations } from "../hooks/use-designations";
import {
  designationCreateHref,
  designationEditHref,
  DESIGNATION_LIST,
} from "../lib/designation-navigation";

import type { Designation } from "../types/designation";

export function DesignationWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.structure.manage");
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");

  const { data: companies = [] } = useCompanies();

  const {
    data: designations = [],
    refetch,
    isFetching,
    isLoading,
    error,
  } = useDesignations(companyId || undefined);

  const filteredDesignations = useMemo(() => {
    const keyword = search.toLowerCase();

    return designations.filter((designation) => {
      const departmentNames =
        designation.onboardingTemplate?.versions?.[0]?.departments
          ?.map(
            (entry) =>
              entry.department?.departmentName ??
              entry.department?.departmentCode ??
              "",
          )
          .join(" ")
          .toLowerCase() ?? "";

      const homeDepartment = [
        designation.department?.departmentName,
        designation.department?.departmentCode,
        designation.department?.branch?.branchName,
        designation.department?.branch?.branchCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        designation.designationCode.toLowerCase().includes(keyword) ||
        designation.designationName.toLowerCase().includes(keyword) ||
        departmentNames.includes(keyword) ||
        homeDepartment.includes(keyword)
      );
    });
  }, [designations, search]);

  const activeCount = designations.filter((x) => x.isActive).length;
  const inactiveCount = designations.length - activeCount;

  const handleCreate = () => {
    router.push(
      designationCreateHref({
        source: "designations",
        returnTo: DESIGNATION_LIST,
      }),
    );
  };

  const handleEdit = canManage
    ? (designation: Designation) => {
        router.push(
          designationEditHref(designation.id, {
            source: "designations",
            returnTo: DESIGNATION_LIST,
          }),
        );
      }
    : undefined;

  return (
    <WorkspaceShell>
      <AdminStructureReadiness />
      {!canManage ? (
        <p className="text-muted-foreground text-sm">
          You can view designations. Creating or editing them needs
          Organization Owner / Company Admin. HR links checklist departments
          from Onboarding Templates.
        </p>
      ) : null}
      <KpiGrid columns={3}>
        <KpiCard
          title="Total Designations"
          value={isLoading ? "—" : designations.length}
          icon={Briefcase}
          helperText="For the selected company"
          density="compact"
        />

        <KpiCard
          title="Active"
          value={isLoading ? "—" : activeCount}
          icon={CheckCircle2}
          helperText="Currently enabled"
          tone="success"
          density="compact"
        />

        <KpiCard
          title="Inactive"
          value={isLoading ? "—" : inactiveCount}
          icon={PauseCircle}
          helperText="Currently disabled"
          tone="neutral"
          density="compact"
        />
      </KpiGrid>

      <FilterPanel className="max-w-2xl">
        <div className="space-y-2">
          <RequiredLabel required>Company</RequiredLabel>

          <LookupSelect
            value={companyId}
            onChange={setCompanyId}
            items={companies}
            placeholder="Select Company"
          />
        </div>
      </FilterPanel>

      <DesignationToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={handleCreate}
        onRefresh={() => refetch()}
        refreshing={isFetching}
      />

      <DesignationTable
        data={filteredDesignations}
        onEdit={handleEdit}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load designations.")
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />
    </WorkspaceShell>
  );
}
