"use client";

import { useQuery } from "@tanstack/react-query";

import { LookupService } from "../services";

interface DepartmentLookupOptions {
  enabled?: boolean;
  companyId?: string;
}

export function useDepartments(
  branchId?: string,
  options: DepartmentLookupOptions = {},
) {
  return useQuery({
    queryKey: ["lookups", "departments", branchId, options.companyId],
    queryFn: () => LookupService.getDepartments(branchId, options.companyId),
    enabled: options.enabled ?? true,
  });
}
