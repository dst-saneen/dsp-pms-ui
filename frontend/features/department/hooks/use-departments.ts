"use client";

import { useQuery } from "@tanstack/react-query";

import { DepartmentService } from "../services/department-service";

export function useDepartments(branchId?: string, companyId?: string) {
  return useQuery({
    queryKey: ["departments", companyId, branchId],
    queryFn: () => DepartmentService.getDepartments(branchId, companyId),
  });
}
