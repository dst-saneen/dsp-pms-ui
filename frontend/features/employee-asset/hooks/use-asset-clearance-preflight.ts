"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeAssetService } from "../services";
import { employeeAssetKeys } from "./query-keys";

export function useAssetClearancePreflight(employeeId: string) {
  return useQuery({
    queryKey: [...employeeAssetKeys.all, "clearance-preflight", employeeId],
    enabled: Boolean(employeeId),
    queryFn: () => EmployeeAssetService.getClearancePreflight(employeeId),
  });
}
