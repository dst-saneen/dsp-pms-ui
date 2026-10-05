"use client";

import { useQuery } from "@tanstack/react-query";

import { OnboardingTemplateService } from "../services/onboarding-template-service";

export function useOnboardingTemplate(
  id: string,
) {
  return useQuery({
    queryKey: [
      "onboarding-template",
      id,
    ],

    enabled: !!id,

    queryFn: () =>
      OnboardingTemplateService.getById(id),
  });
}