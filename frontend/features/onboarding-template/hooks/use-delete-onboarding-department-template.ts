"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OnboardingTemplateService } from "../services";

export function useDeleteOnboardingDepartmentTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; expectedVersion: number }) =>
      OnboardingTemplateService.deleteDepartmentTemplate(input.id, input.expectedVersion),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-templates"],
      });
      queryClient.invalidateQueries({
        queryKey: ["designation-onboarding-workspace"],
      });
      queryClient.invalidateQueries({
        queryKey: ["designations"],
      });
    },
  });
}
