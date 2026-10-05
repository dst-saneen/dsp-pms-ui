"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  EmployeeOnboardingTaskService,
  type StartEmployeeOnboardingTaskDto,
} from "../services";

export function useStartEmployeeOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto?: StartEmployeeOnboardingTaskDto;
    }) =>
      EmployeeOnboardingTaskService.start(
        id,
        dto,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee-onboarding"],
      });
    },
  });
}
