"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeAssetService } from "../services";
import { employeeAssetKeys } from "./query-keys";

export function useEmployeeAssetsByEmployee(
  employeeId: string,
) {
  return useQuery({
    queryKey: employeeAssetKeys.byEmployee(employeeId),
    enabled: !!employeeId,
    queryFn: () =>
      EmployeeAssetService.getByEmployee(employeeId),
  });
}
