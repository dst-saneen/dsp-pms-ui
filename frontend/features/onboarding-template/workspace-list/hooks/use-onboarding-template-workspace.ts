"use client";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  OnboardingTemplateWorkspaceService,
} from "../services";

export function useOnboardingTemplateWorkspace() {

  return useQuery({

    queryKey: [
      "onboarding-template-workspace",
    ],

    queryFn: () =>
      OnboardingTemplateWorkspaceService.getAll(),

  });

}