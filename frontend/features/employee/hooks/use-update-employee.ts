"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeService } from "../services/employee-service";
import type { UpdateEmployee } from "../types/update-employee";

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateEmployee;
    }) => EmployeeService.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });

      queryClient.invalidateQueries({
        queryKey: ["employee-summary"],
      });

      queryClient.invalidateQueries({
        queryKey: ["lookups", "managers"],
      });
    },
  });
}
