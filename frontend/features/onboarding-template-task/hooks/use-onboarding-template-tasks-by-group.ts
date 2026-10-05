"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingTemplateTaskService,
} from "../services";

export function useOnboardingTemplateTasksByGroup(
  taskGroupId: string,
) {

  return useQuery({

    queryKey: [
      "onboarding-template-task",
      "group",
      taskGroupId,
    ],

    queryFn: () =>
      OnboardingTemplateTaskService.getByTaskGroup(
        taskGroupId,
      ),

    enabled: !!taskGroupId,

  });

}