"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  OnboardingTemplateService,
} from "../services";

export function useCreateOnboardingDepartmentTemplate() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: (
      data: {
        onboardingTemplateVersionId: string;
        departmentId: string;
      },
    ) =>
      OnboardingTemplateService.createDepartmentTemplate(
        data,
      ),

    onSuccess: () => {

      queryClient.invalidateQueries({
        queryKey: ["onboarding-templates"],
      });

    },

  });

}