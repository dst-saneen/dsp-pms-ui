"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";

import type { EmployeeOnboardingSearch } from "../types/employee-onboarding-search";

export function useEmployeeOnboardings(
  params?: EmployeeOnboardingSearch,
) {
  return useQuery({
    queryKey: [
      "employee-onboarding",
      params,
    ],

    queryFn: () =>
      EmployeeOnboardingService.getAll(
        params,
      ),
  });
}