"use client";

import { useQuery } from "@tanstack/react-query";

import { OnboardingTemplateService } from "../services/onboarding-template-service";

export function useOnboardingTemplateSummary() {
  return useQuery({
    queryKey: ["onboarding-template-summary"],
    queryFn: () =>
      OnboardingTemplateService.getSummary(),
  });
}