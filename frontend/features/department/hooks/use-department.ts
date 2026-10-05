"use client";

import { useQuery } from "@tanstack/react-query";

import { DepartmentService } from "../services/department-service";

export function useDepartment(id?: string) {
  return useQuery({
    queryKey: ["departments", "detail", id],
    queryFn: () => DepartmentService.getDepartment(id!),
    enabled: Boolean(id),
  });
}
