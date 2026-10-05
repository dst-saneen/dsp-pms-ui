"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Layers3, PauseCircle } from "lucide-react";

import { AdminStructureReadiness } from "@/features/administration/components/admin-structure-readiness";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import { CompanyToolbar } from "./company-toolbar";
import { CompanyTable } from "./company-table";
import {
  companyCreateHref,
  companyEditHref,
} from "../lib/company-navigation";
import { useCompanies } from "../hooks/use-companies";
import type { Company } from "../types/company";

export function CompanyWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.companies.manage");
  const { data: companies = [], refetch, isFetching, isLoading, error } =
    useCompanies();
  const [search, setSearch] = useState("");
  const keyword = search.trim().toLowerCase();

  const filteredCompanies = companies.filter((company) => {
    return (
      (company.companyCode ?? "").toLowerCase().includes(keyword) ||
      (company.companyName ?? "").toLowerCase().includes(keyword) ||
      (company.registrationNo ?? "").toLowerCase().includes(keyword) ||
      (company.taxNumber ?? "").toLowerCase().includes(keyword) ||
      (company.companyGroup?.groupName ?? "").toLowerCase().includes(keyword) ||
      (company.parentCompany?.companyName ?? "").toLowerCase().includes(keyword)
    );
  });

  return (
    <WorkspaceShell>
      <AdminStructureReadiness />

      <KpiGrid columns={4}>
        <KpiCard
          title="Total Companies"
          value={isLoading ? "—" : companies.length}
          icon={Building2}
          helperText="Across all company groups"
          density="compact"
        />
        <KpiCard
          title="Active"
          value={isLoading ? "—" : companies.filter((x) => x.isActive).length}
          icon={CheckCircle2}
          helperText="Currently enabled"
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Inactive"
          value={isLoading ? "—" : companies.filter((x) => !x.isActive).length}
          icon={PauseCircle}
          helperText="Currently disabled"
          tone="neutral"
          density="compact"
        />
        <KpiCard
          title="Company Groups"
          value={
            isLoading
              ? "—"
              : new Set(
                  companies
                    .filter((x) => x.companyGroupId)
                    .map((x) => x.companyGroupId),
                ).size
          }
          icon={Layers3}
          helperText="Represented in this list"
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <CompanyToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={
          canManage
            ? () => router.push(companyCreateHref())
            : undefined
        }
        onRefresh={refetch}
        refreshing={isFetching}
      />

      <CompanyTable
        data={filteredCompanies}
        onEdit={(company: Company) =>
          router.push(companyEditHref(company.id))
        }
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load companies.")
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />
    </WorkspaceShell>
  );
}
