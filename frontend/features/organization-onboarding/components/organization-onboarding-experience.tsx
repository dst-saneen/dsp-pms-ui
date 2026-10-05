"use client";

import type { OrganizationOnboardingStatus } from "../types";

import { OnboardingHubMainPanel } from "./onboarding-hub-main-panel";
import { OnboardingHubMarketing } from "./onboarding-hub-marketing";
import { OnboardingHubShell } from "./onboarding-hub-shell";
import { OnboardingHubSummary } from "./onboarding-hub-summary";

interface OrganizationOnboardingExperienceProps {
  status: OrganizationOnboardingStatus;
}

/**
 * Organization onboarding readiness hub.
 * Progress, edits, required/optional actions, and open-workspace CTA.
 */
export function OrganizationOnboardingExperience({
  status,
}: OrganizationOnboardingExperienceProps) {
  return (
    <OnboardingHubShell
      marketing={<OnboardingHubMarketing />}
      main={<OnboardingHubMainPanel status={status} />}
      summary={<OnboardingHubSummary status={status} />}
    />
  );
}
