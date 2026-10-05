"use client";

import { Briefcase, Building2, Clock3 } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";

import type { DesignationOnboardingWorkspace } from "@/features/designation/types";

interface Props {
  data: DesignationOnboardingWorkspace[];
  isLoading?: boolean;
}

export function OnboardingTemplateSummaryCards({ data, isLoading = false }: Props) {
  const totalDesignations = data.length;

  const departmentsConfigured = data.filter((designation) => {
    const version = designation.onboardingTemplate?.versions?.[0];

    return (version?.departments?.length ?? 0) > 0;
  }).length;

  const pendingConfiguration = totalDesignations - departmentsConfigured;

  return (
    <KpiGrid columns={3}>
      <KpiCard
        title="Total Designations"
        value={isLoading ? "—" : totalDesignations}
        icon={Briefcase}
        helperText="Available onboarding roles"
        density="compact"
      />

      <KpiCard
        title="Departments Configured"
        value={isLoading ? "—" : departmentsConfigured}
        icon={Building2}
        helperText="Ready for onboarding"
        tone="success"
        density="compact"
      />

      <KpiCard
        title="Pending Configuration"
        value={isLoading ? "—" : pendingConfiguration}
        icon={Clock3}
        helperText="Still needs setup"
        tone="warning"
        density="compact"
      />
    </KpiGrid>
  );
}
