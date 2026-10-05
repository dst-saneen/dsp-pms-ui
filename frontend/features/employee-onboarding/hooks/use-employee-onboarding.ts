"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeOnboardingService } from "../services/employee-onboarding-service";

/** Load one onboarding instance by its id (not employee id). */
export function useEmployeeOnboarding(onboardingId: string) {
  return useQuery({
    queryKey: ["employee-onboarding", onboardingId],
    enabled: !!onboardingId,
    queryFn: () => EmployeeOnboardingService.getById(onboardingId),
  });
}
