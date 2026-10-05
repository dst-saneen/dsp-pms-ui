"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { OnboardingTemplateService } from "../services/onboarding-template-service";
import { onboardingTemplateKeys } from "./query-keys";

export function useCreateOnboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: OnboardingTemplateService.create,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: onboardingTemplateKeys.all,
      });
    },
  });
}