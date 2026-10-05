"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  OnboardingTaskGroupService,
  type UpdateOnboardingTaskGroupDto,
} from "../services";

interface UpdateTaskGroupRequest {
  id: string;
  dto: UpdateOnboardingTaskGroupDto;
}

export function useUpdateOnboardingTaskGroup(
  templateId: string,
) {
  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: ({
      id,
      dto,
    }: UpdateTaskGroupRequest) =>
      OnboardingTaskGroupService.update(
        id,
        dto,
      ),

    onSuccess: (
      _,
      variables,
    ) => {

      queryClient.invalidateQueries({
        queryKey: [
          "onboarding-workspace",
          templateId,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "onboarding-task-group",
          variables.id,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "onboarding-task-groups",
        ],
      });

    },

  });
}