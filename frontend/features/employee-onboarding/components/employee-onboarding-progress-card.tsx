"use client";

import { InfoCard } from "@/components/common/info-card";

import { OnboardingProgress } from "./employee-onboarding-progress";

import type { EmployeeOnboarding } from "../types/employee-onboarding";

interface Props {
  onboarding: EmployeeOnboarding;
}

export function OnboardingProgressCard({
  onboarding,
}: Props) {
  const total =
    onboarding.tasks?.length ?? 0;

  const completed =
    onboarding.tasks?.filter(
      (task) => task.status === "COMPLETED",
    ).length ?? 0;

  return (
    <InfoCard title="Progress">
      <div className="space-y-4">
        <OnboardingProgress
          completed={completed}
          total={total}
        />

        <p className="text-sm text-muted-foreground">
          {completed} of {total} tasks completed
        </p>
      </div>
    </InfoCard>
  );
}