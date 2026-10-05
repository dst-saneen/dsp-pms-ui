"use client";

import { DataTable } from "@/components/tables/data-table";

import { onboardingTemplateColumns } from "./onboarding-template-columns";

import type { DesignationOnboardingWorkspace } from "@/features/designation/types";

interface Props {
  data: DesignationOnboardingWorkspace[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  onSelect?: (designation: DesignationOnboardingWorkspace) => void;
}

export function OnboardingTemplateTable({ data, isLoading, error, onRetry, onSelect }: Props) {
  return (
    <DataTable
      columns={onboardingTemplateColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No onboarding templates"
      emptyDescription="No designations match the current search."
      onRowClick={
        onSelect
          ? (designation) => {
              onSelect(designation);
            }
          : undefined
      }
      getRowLabel={(designation) => `Open onboarding template for ${designation.designationName}`}
    />
  );
}
