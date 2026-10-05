"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  EmployeeOnboardingTaskService,
  type SkipEmployeeOnboardingTaskDto,
} from "../services";

export function useSkipEmployeeOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: SkipEmployeeOnboardingTaskDto;
    }) =>
      EmployeeOnboardingTaskService.skip(
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
