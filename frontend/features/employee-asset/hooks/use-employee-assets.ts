"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeAssetService } from "../services";
import { employeeAssetKeys } from "./query-keys";

export function useEmployeeAssets() {
  return useQuery({
    queryKey: employeeAssetKeys.lists(),
    queryFn: () => EmployeeAssetService.getAll(),
  });
}
