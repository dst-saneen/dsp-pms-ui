"use client";

import { useQuery } from "@tanstack/react-query";

import { OnboardingTemplateService } from "../services/onboarding-template-service";

import type { OnboardingTemplateSearch } from "../types/onboarding-template-search";

export function useOnboardingTemplates(
  params?: OnboardingTemplateSearch,
) {
  return useQuery({
    queryKey: [
      "onboarding-template",
      params,
    ],

    queryFn: () =>
      OnboardingTemplateService.getAll(
        params,
      ),
  });
}