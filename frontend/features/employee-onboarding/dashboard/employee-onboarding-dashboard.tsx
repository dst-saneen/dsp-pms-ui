"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleX, ClipboardList, Clock3 } from "lucide-react";

import { EmployeeOnboardingToolbar } from "./employee-onboarding-toolbar";
import { EmployeeOnboardingTable } from "./employee-onboarding-table";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";

import { useEmployeeOnboardingSummary } from "../hooks";
import { startEmployeeOnboardingHref } from "../lib/start-onboarding-navigation";

export function EmployeeOnboardingDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const searchParams = useMemo(
    () => ({
      search: search.trim() || undefined,
    }),
    [search],
  );

  const {
    data: summary = {
      total: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    },
    isLoading: summaryLoading,
  } = useEmployeeOnboardingSummary();

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["employee-onboarding"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["employee-onboarding-summary"],
      }),
    ]);
  };

  return (
    <WorkspaceShell>
      <KpiGrid columns={4}>
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <KpiCard key={index} title="Loading..." value="—" density="compact" />
          ))
        ) : (
          <>
            <KpiCard
              title="Total"
              value={summary.total}
              icon={ClipboardList}
              helperText="All onboarding records"
              density="compact"
            />
            <KpiCard
              title="In Progress"
              value={summary.inProgress}
              icon={Clock3}
              helperText="Currently underway"
              tone="progress"
              density="compact"
            />
            <KpiCard
              title="Completed"
              value={summary.completed}
              icon={CheckCircle2}
              helperText="Finished workflows"
              tone="success"
              density="compact"
            />
            <KpiCard
              title="Cancelled"
              value={summary.cancelled}
              icon={CircleX}
              helperText="Cancelled workflows"
              tone="neutral"
              density="compact"
            />
          </>
        )}
      </KpiGrid>

      <EmployeeOnboardingToolbar
        onAdd={() =>
          router.push(
            startEmployeeOnboardingHref({
              returnTo: "/hr/employee-onboarding",
            }),
          )
        }
        onRefresh={handleRefresh}
        search={search}
        onSearchChange={setSearch}
      />

      <EmployeeOnboardingTable searchParams={searchParams} />
    </WorkspaceShell>
  );
}
