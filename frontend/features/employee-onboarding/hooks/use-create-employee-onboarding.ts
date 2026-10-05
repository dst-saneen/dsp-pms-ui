"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";
import { employeeOnboardingKeys } from "./query-keys";

export function useCreateEmployeeOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: EmployeeOnboardingService.create,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: employeeOnboardingKeys.all,
      });
    },
  });
}