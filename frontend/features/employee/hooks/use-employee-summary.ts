"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeService } from "../services/employee-service";

export function useEmployeeSummary() {
  return useQuery({
    queryKey: ["employee-summary"],
    queryFn: EmployeeService.summary,
    staleTime: 1000 * 60 * 5,
  });
}