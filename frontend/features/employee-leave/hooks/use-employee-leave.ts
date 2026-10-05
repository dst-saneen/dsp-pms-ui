"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeLeaveService } from "../services";
import { employeeLeaveQueryKeys } from "./query-keys";

export function useEmployeeLeave(
  employeeId: string,
  year?: number,
) {
  return useQuery({
    queryKey: employeeLeaveQueryKeys.profile(
      employeeId,
      year,
    ),

    enabled: !!employeeId,

    queryFn: () =>
      EmployeeLeaveService.getProfile(
        employeeId,
        year,
      ),
  });
}