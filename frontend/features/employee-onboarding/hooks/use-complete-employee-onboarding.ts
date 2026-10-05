"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";
import { employeeOnboardingKeys } from "./query-keys";

export function useCompleteEmployeeOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      expectedOnboardingVersion,
    }: {
      id: string;
      expectedOnboardingVersion?: number;
    }) =>
      EmployeeOnboardingService.complete(id, {
        expectedOnboardingVersion,
      }),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: employeeOnboardingKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: employeeOnboardingKeys.detail(variables.id),
      });
    },
  });
}