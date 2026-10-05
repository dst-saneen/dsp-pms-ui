"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { OnboardingTemplateService } from "../services/onboarding-template-service";
import { onboardingTemplateKeys } from "./query-keys";

import type { UpdateOnboardingTemplate } from "../types/update-onboarding-template";

interface UpdateArgs {
  id: string;
  dto: UpdateOnboardingTemplate;
}

export function useUpdateOnboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: UpdateArgs) =>
      OnboardingTemplateService.update(
        id,
        dto,
      ),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: onboardingTemplateKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey:
          onboardingTemplateKeys.detail(
            variables.id,
          ),
      });
    },
  });
}