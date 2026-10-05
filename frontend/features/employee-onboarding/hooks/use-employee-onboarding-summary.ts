"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";

export function useEmployeeOnboardingSummary() {
  return useQuery({
    queryKey: [
      "employee-onboarding-summary",
    ],

    queryFn: () =>
      EmployeeOnboardingService.getSummary(),
  });
}