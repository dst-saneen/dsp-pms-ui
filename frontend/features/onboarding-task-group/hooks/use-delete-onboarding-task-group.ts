"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OnboardingTaskGroupService } from "../services";

export function useDeleteOnboardingTaskGroup(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; expectedVersion: number }) =>
      OnboardingTaskGroupService.delete(input.id, input.expectedVersion),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-workspace", templateId],
      });
    },
  });
}
