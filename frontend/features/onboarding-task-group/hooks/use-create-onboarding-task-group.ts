"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  OnboardingTaskGroupService,
} from "../services";

export function useCreateOnboardingTaskGroup(
  templateId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: OnboardingTaskGroupService.create,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-workspace", templateId],
      });
      await queryClient.refetchQueries({
        queryKey: ["onboarding-workspace", templateId],
      });
    },
  });
}