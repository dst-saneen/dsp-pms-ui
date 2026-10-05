"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  OnboardingDepartmentTemplateService,
} from "../services";

export function useDeleteOnboardingDepartment(
  templateId: string,
) {
  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: (id: string) =>
      OnboardingDepartmentTemplateService.delete(id),

    onSuccess: () => {

      queryClient.invalidateQueries({
        queryKey: [
          "onboarding-workspace",
          templateId,
        ],
      });

    },

  });
}