"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  EmployeeOnboardingTaskService,
  type ReopenEmployeeOnboardingTaskDto,
} from "../services";

export function useReopenEmployeeOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: ReopenEmployeeOnboardingTaskDto;
    }) =>
      EmployeeOnboardingTaskService.reopen(
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