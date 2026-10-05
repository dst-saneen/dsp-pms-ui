"use client";

import { useRef, useState } from "react";
import { Building2, CircleCheck, CirclePause, Plus, RefreshCw } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/services/api-client";

import { CompanyGroupTable } from "./company-group-table";

import { CompanyGroupDialog } from "../dialogs/company-group-dialog";

import { useCompanyGroups } from "../hooks/use-company-groups";

import type { CompanyGroup } from "../types/company-group";

export function CompanyGroupWorkspace() {
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [selectedCompanyGroup, setSelectedCompanyGroup] = useState<CompanyGroup | null>(null);

  const { data: companyGroups = [], refetch, isFetching, isLoading, error } = useCompanyGroups();

  const [search, setSearch] = useState("");

  const keyword = search.trim().toLowerCase();

  const filteredCompanyGroups = companyGroups.filter((group) => {
    return (
      group.groupCode.toLowerCase().includes(keyword) ||
      group.groupName.toLowerCase().includes(keyword)
    );
  });

  const rememberTrigger = (trigger?: HTMLElement) => {
    if (trigger) {
      returnFocusRef.current = trigger;
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
  };

  const handleCreate = (trigger?: HTMLElement) => {
    rememberTrigger(trigger);
    setSelectedCompanyGroup(null);
    setOpen(true);
  };

  const handleEdit = (companyGroup: CompanyGroup, trigger?: HTMLElement) => {
    rememberTrigger(trigger);
    setSelectedCompanyGroup(companyGroup);
    setOpen(true);
  };

  return (
    <WorkspaceShell>
      <PageHeader
        title="Company Groups"
        description="Manage the top-level organizations in your ERP hierarchy."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refetch();
              }}
              disabled={isFetching}
            >
              <RefreshCw
                className={isFetching ? "animate-spin motion-reduce:animate-none" : undefined}
                aria-hidden="true"
              />
              {isFetching ? "Refreshing..." : "Refresh"}
            </Button>
            <Button type="button" onClick={(event) => handleCreate(event.currentTarget)}>
              <Plus aria-hidden="true" />
              Add Company Group
            </Button>
          </>
        }
      />

      <KpiGrid columns={3}>
        <KpiCard
          title="Total Groups"
          value={isLoading ? "—" : companyGroups.length}
          icon={Building2}
          helperText="Across the ERP hierarchy"
          density="compact"
        />
        <KpiCard
          title="Active"
          value={isLoading ? "—" : companyGroups.filter((x) => x.isActive).length}
          icon={CircleCheck}
          helperText="Currently enabled"
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Inactive"
          value={isLoading ? "—" : companyGroups.filter((x) => !x.isActive).length}
          icon={CirclePause}
          helperText="Currently disabled"
          tone="neutral"
          density="compact"
        />
      </KpiGrid>

      <CompanyGroupTable
        data={filteredCompanyGroups}
        totalCount={companyGroups.length}
        search={search}
        onSearchChange={setSearch}
        onCreate={handleCreate}
        onEdit={handleEdit}
        isLoading={isLoading}
        error={error ? getApiErrorMessage(error, "We could not load company groups.") : null}
        onRetry={() => {
          void refetch();
        }}
      />

      <CompanyGroupDialog
        open={open}
        onOpenChange={setOpen}
        companyGroup={selectedCompanyGroup}
        returnFocusRef={returnFocusRef}
      />
    </WorkspaceShell>
  );
}
