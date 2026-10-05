"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingDepartmentTemplateService,
} from "../services";

export function useOnboardingDepartment(
  id?: string,
) {
  return useQuery({

    enabled: !!id,

    queryKey: [
      "onboarding-department",
      id,
    ],

    queryFn: () =>
      OnboardingDepartmentTemplateService.findOne(
        id!,
      ),

  });
}