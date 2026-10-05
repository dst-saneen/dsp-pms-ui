"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OnboardingDepartmentTemplateService } from "../../onboarding-template/services/onboarding-department-template.service";

export function useCreateOnboardingDepartment(
  templateId: string,
) {
  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      OnboardingDepartmentTemplateService.create,

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