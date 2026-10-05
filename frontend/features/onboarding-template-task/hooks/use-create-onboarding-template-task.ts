"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { OnboardingTemplateTaskService } from "../services";

import { onboardingTemplateTaskKeys } from "./query-keys";

export function useCreateOnboardingTemplateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      OnboardingTemplateTaskService.create,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          onboardingTemplateTaskKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-workspace"],
      });
    },
  });
}