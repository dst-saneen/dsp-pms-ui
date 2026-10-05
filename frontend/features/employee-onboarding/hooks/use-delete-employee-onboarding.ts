"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";
import { employeeOnboardingKeys } from "./query-keys";

export function useDeleteEmployeeOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: EmployeeOnboardingService.delete,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: employeeOnboardingKeys.all,
      });
    },
  });
}