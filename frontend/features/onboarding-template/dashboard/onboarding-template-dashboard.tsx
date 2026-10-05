"use client";

import { useState } from "react";

import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getApiErrorMessage } from "@/services/api-client";

import {
  OnboardingTemplateTable,
  OnboardingTemplateToolbar,
  OnboardingTemplateSummaryCards,
} from "../components";

import { useDesignationOnboardingWorkspace } from "@/features/designation/hooks";
import { useAuth } from "@/providers/auth-provider";

export function OnboardingTemplateDashboard() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useDesignationOnboardingWorkspace({
    keyword: search,
    companyId: user?.authorization.activeCompanyId,
  });

  return (
    <WorkspaceShell>
      <OnboardingTemplateSummaryCards data={data} isLoading={isLoading} />

      <OnboardingTemplateToolbar search={search} onSearchChange={setSearch} />

      <p className="text-muted-foreground text-sm">
        Use{" "}
        <span className="font-medium text-foreground">Create Designation</span>{" "}
        to add a designation and its first onboarding involvement department.
        Expand <span className="font-medium text-foreground">Departments</span>{" "}
        on a row, then click a department name to edit its checklist. Use{" "}
        <span className="font-medium text-foreground">Add Department</span> in
        the expanded list to attach another department.
      </p>

      <OnboardingTemplateTable
        data={data}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(
                error,
                "We could not load onboarding templates.",
              )
            : null
        }
        onRetry={() => {
          void refetch();
        }}
      />
    </WorkspaceShell>
  );
}
