"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  OnboardingTemplateService,
} from "../services";

export function useDeleteOnboardingTemplate() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      OnboardingTemplateService.delete,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-templates",
        ],

      });

    },

  });

}