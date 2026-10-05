"use client";

import { useQuery } from "@tanstack/react-query";

import { OnboardingTemplateVersionService } from "../services/onboarding-template-version-service";
import { onboardingTemplateKeys } from "./query-keys";

export function useOnboardingTemplateVersionHistory(
  templateId?: string,
) {
  return useQuery({
    queryKey: onboardingTemplateKeys.versionHistory(templateId ?? ""),
    enabled: !!templateId,
    queryFn: () =>
      OnboardingTemplateVersionService.history(templateId!),
  });
}
