"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OnboardingTemplateTaskService } from "../services";

import { onboardingTemplateTaskKeys } from "./query-keys";

import { onboardingTemplateKeys } from "@/features/onboarding-template/hooks";

export function useDeleteOnboardingTemplateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; expectedVersion: number }) =>
      OnboardingTemplateTaskService.delete(input.id, input.expectedVersion),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: onboardingTemplateTaskKeys.all,
        }),

        queryClient.invalidateQueries({
          queryKey: onboardingTemplateKeys.all,
        }),

        queryClient.invalidateQueries({
          queryKey: ["onboarding-workspace"],
        }),
      ]);
    },
  });
}
