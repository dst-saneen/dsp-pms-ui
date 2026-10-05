"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingTemplateTaskService,
} from "../services";

export function useOnboardingTemplateTask(
  id?: string,
) {
  return useQuery({

    enabled: !!id,

    queryKey: [
      "onboarding-template-task",
      id,
    ],

    queryFn: () =>
      OnboardingTemplateTaskService.getById(
        id!,
      ),

  });
}