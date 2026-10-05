"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingTaskGroupService,
} from "../services";

export function useOnboardingTaskGroup(
  id?: string,
) {
  return useQuery({

    enabled: !!id,

    queryKey: [
      "onboarding-task-group",
      id,
    ],

    queryFn: () =>
        OnboardingTaskGroupService.getById(
            id!,
        ),

  });
}