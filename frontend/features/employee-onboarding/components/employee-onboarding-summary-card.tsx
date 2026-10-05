"use client";

import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";

import { OnboardingStatusBadge } from "./employee-onboarding-status-badge";

import type { EmployeeOnboarding } from "../types/employee-onboarding";

interface Props {
  onboarding: EmployeeOnboarding;
}

export function OnboardingSummaryCard({
  onboarding,
}: Props) {
  return (
    <InfoCard title="Onboarding Summary">
      <InfoRow
        label="Status"
        value={
          <OnboardingStatusBadge
            status={onboarding.status}
          />
        }
      />

      <InfoRow
        label="Template"
        value={
          onboarding.template?.templateName ??
          "-"
        }
      />

      <InfoRow
        label="Start Date"
        value={
            onboarding.startDate ?? "-"
        }
        />

      <InfoRow
        label="Completed"
        value={
            onboarding.completedDate ?? "-"
        }
        />
    </InfoCard>
  );
}