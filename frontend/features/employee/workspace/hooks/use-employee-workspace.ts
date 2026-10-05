"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeWorkspaceService } from "../services/employee-workspace-service";

export function useEmployeeWorkspace(
  employeeId: string,
) {
  return useQuery({
    queryKey: ["employee-workspace", employeeId],

    queryFn: () =>
      EmployeeWorkspaceService.getByEmployeeId(
        employeeId,
      ),

    enabled: !!employeeId,
  });
}