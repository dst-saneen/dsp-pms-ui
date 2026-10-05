"use client";

import { ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { OnboardingSummaryCard } from "./employee-onboarding-summary-card";
import { OnboardingProgressCard } from "./employee-onboarding-progress-card";
import { OnboardingTaskTable } from "./employee-onboarding-task-table";

import { useEmployeeOnboardingByEmployee } from "../hooks/use-employee-onboarding-by-employee";

interface OnboardingProfileProps {
  employeeId: string;
}

export function OnboardingProfile({ employeeId }: OnboardingProfileProps) {
  const { data: onboarding, isLoading } = useEmployeeOnboardingByEmployee(employeeId);

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-label="Loading onboarding">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No Onboarding"
        description="No onboarding workflow has been started for this employee."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <OnboardingSummaryCard onboarding={onboarding} />

        <OnboardingProgressCard onboarding={onboarding} />
      </div>

      <OnboardingTaskTable tasks={onboarding.tasks ?? []} />

      {/* Phase 3 */}
      {/* Timeline */}
    </div>
  );
}
