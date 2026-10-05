"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, PauseCircle } from "lucide-react";

import { FilterPanel } from "@/components/common/filter-panel";
import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { ShiftToolbar } from "./shift-toolbar";
import { ShiftTable } from "./shift-table";
import { ShiftDialog } from "../dialogs/shift-dialog";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useShifts } from "../hooks/use-shifts";

import type { Shift } from "../types/shift";

export function ShiftWorkspace() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("hr.schedule.manage");
  const [search, setSearch] = useState("");

  const [companyId, setCompanyId] = useState("");

  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");

  const [open, setOpen] = useState(false);

  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const { data: companies = [] } = useCompanies();

  const {
    data: shifts = [],
    refetch,
    isFetching,
    isLoading,
    error,
  } = useShifts(companyId || undefined, status === "all" ? undefined : status === "active");

  const filteredShifts = useMemo(() => {
    const keyword = search.toLowerCase();

    return shifts.filter(
      (shift) =>
        shift.shiftCode.toLowerCase().includes(keyword) ||
        shift.shiftName.toLowerCase().includes(keyword)
    );
  }, [shifts, search]);

  const activeCount = shifts.filter((x) => x.isActive).length;

  const inactiveCount = shifts.length - activeCount;

  const handleCreate = () => {
    setSelectedShift(null);
    setOpen(true);
  };

  const handleEdit = (shift: Shift) => {
    setSelectedShift(shift);

    setOpen(true);
  };

  const statusOptions = [
    {
      id: "active",
      name: "Active",
    },
    {
      id: "inactive",
      name: "Inactive",
    },
    {
      id: "all",
      name: "All",
    },
  ];

  return (
    <WorkspaceShell>
      <KpiGrid columns={3}>
        <KpiCard
          title="Total Shifts"
          value={isLoading ? "—" : shifts.length}
          icon={Clock3}
          helperText="For the selected filters"
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

      <FilterPanel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <div className="space-y-2">
            <RequiredLabel required>Company</RequiredLabel>

            <LookupSelect
              value={companyId}
              onChange={setCompanyId}
              items={companies}
              placeholder="Select Company"
            />
          </div>

          <div className="space-y-2">
            <RequiredLabel>Status</RequiredLabel>

            <LookupSelect
              value={status}
              onChange={(value) => setStatus(value as "active" | "inactive" | "all")}
              items={statusOptions}
              placeholder="Status"
            />
          </div>
        </div>
      </FilterPanel>

      <ShiftToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={handleCreate}
        canCreate={canCreate}
        onRefresh={() => refetch()}
        refreshing={isFetching}
      />

      <ShiftTable
        data={filteredShifts}
        onEdit={canCreate ? handleEdit : undefined}
        isLoading={isLoading}
        error={error ? getApiErrorMessage(error, "We could not load shifts.") : null}
        onRetry={() => {
          void refetch();
        }}
      />

      <ShiftDialog open={open} onOpenChange={setOpen} shift={selectedShift} />
    </WorkspaceShell>
  );
}
