"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services";

export function useEmployeeDocumentsByEmployee(
  employeeId: string,
) {
  return useQuery({
    queryKey: [
      "employee-documents",
      "employee",
      employeeId,
    ],

    queryFn: () =>
      EmployeeDocumentService.getByEmployee(
        employeeId,
      ),

    enabled: !!employeeId,
  });
}