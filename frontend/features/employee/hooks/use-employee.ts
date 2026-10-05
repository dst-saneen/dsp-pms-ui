"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeService } from "../services/employee-service";

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: () => EmployeeService.getById(id),
    enabled: !!id,
  });
}