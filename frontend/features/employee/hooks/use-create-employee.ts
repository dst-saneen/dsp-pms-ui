"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeService } from "../services/employee-service";
import type { CreateEmployee } from "../types/create-employee";

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEmployee) =>
      EmployeeService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "managers"],
      });
    },
  });
}
