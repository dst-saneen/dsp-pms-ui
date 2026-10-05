"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  EmployeeOnboardingTaskService,
  type CompleteEmployeeOnboardingTaskDto,
} from "../services";

export function useCompleteEmployeeOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto?: CompleteEmployeeOnboardingTaskDto;
    }) =>
      EmployeeOnboardingTaskService.complete(
        id,
        dto,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee-onboarding"],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "employee-onboarding-summary",
        ],
      });
    },
  });
}