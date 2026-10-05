"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { OnboardingTemplateTaskService } from "../services";

import { onboardingTemplateTaskKeys } from "./query-keys";

import type { UpdateOnboardingTemplateTask } from "../types";

interface UpdateArgs {
  id: string;

  dto: UpdateOnboardingTemplateTask;
}

export function useUpdateOnboardingTemplateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: UpdateArgs) =>
      OnboardingTemplateTaskService.update(
        id,
        dto,
      ),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey:
          onboardingTemplateTaskKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey:
          onboardingTemplateTaskKeys.detail(
            variables.id,
          ),
      });

    },
  });
}