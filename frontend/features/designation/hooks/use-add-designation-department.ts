"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  DesignationOnboardingService,
} from "../services/designation-onboarding.service";

export function useAddDesignationDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      designationId,
      departmentId,
    }: {
      designationId: string;
      departmentId: string;
    }) =>
      DesignationOnboardingService.addDepartment(
        designationId,
        departmentId,
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["designation-onboarding-workspace"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["designations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["onboarding-templates"],
        }),
      ]);
    },
  });
}