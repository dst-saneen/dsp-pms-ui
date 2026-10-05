"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";
import { employeeOnboardingKeys } from "./query-keys";

import type { UpdateEmployeeOnboarding } from "../types/update-employee-onboarding";

interface UpdateArgs {
  id: string;
  dto: UpdateEmployeeOnboarding;
}

export function useUpdateEmployeeOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: UpdateArgs) =>
      EmployeeOnboardingService.update(id, dto),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: employeeOnboardingKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: employeeOnboardingKeys.detail(
          variables.id,
        ),
      });
    },
  });
}