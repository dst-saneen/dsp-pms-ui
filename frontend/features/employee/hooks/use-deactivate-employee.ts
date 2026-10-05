"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeService } from "../services/employee-service";

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      EmployeeService.deactivate(id),

    onSuccess: (_, id) => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["employees"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["employee-summary"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["employee", id],
        }),

        queryClient.invalidateQueries({
          queryKey: ["lookups", "managers"],
        }),
      ]);
    },
  });
}
