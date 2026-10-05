"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingTaskGroupService,
} from "../services";

export function useOnboardingTaskGroupsByDepartment(
  departmentTemplateId?: string,
) {
  return useQuery({

    enabled:
      !!departmentTemplateId,

    queryKey: [
      "onboarding-task-groups",
      departmentTemplateId,
    ],

    queryFn: () =>
      OnboardingTaskGroupService.getByDepartmentTemplate(
        departmentTemplateId!,
      ),

  });
}