"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { EmployeeOnboardingService } from "../services";

export function useEmployeeOnboardingByEmployee(
  employeeId: string,
) {
  return useQuery({
    queryKey: [
      "employee-onboarding",
      "employee",
      employeeId,
    ],

    queryFn: async () => {
      try {
        return await EmployeeOnboardingService.getByEmployee(
          employeeId,
        );
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 404
        ) {
          return null;
        }

        throw error;
      }
    },

    enabled: !!employeeId,
  });
}
