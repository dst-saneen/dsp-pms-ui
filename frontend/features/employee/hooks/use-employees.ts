"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeService } from "../services/employee-service";

import type { EmployeeSearchParams } from "../types/employee-search";

export const EMPLOYEE_QUERY_KEY = ["employees"];

/** Dropdown / small lists — returns Employee[]. */
export function useEmployees(params?: EmployeeSearchParams) {
  return useQuery({
    queryKey: [...EMPLOYEE_QUERY_KEY, "all", params],
    queryFn: () => EmployeeService.getAll(params),
  });
}

/** EMP-001 directory — server-paged result. */
export function useEmployeeDirectory(params?: EmployeeSearchParams) {
  return useQuery({
    queryKey: [...EMPLOYEE_QUERY_KEY, "directory", params],
    queryFn: () => EmployeeService.search(params),
  });
}
