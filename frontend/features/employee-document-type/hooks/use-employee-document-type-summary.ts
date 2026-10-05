"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentTypeService } from "../services/employee-document-type-service";

export function useEmployeeDocumentTypeSummary() {
  return useQuery({
    queryKey: [
      "employee-document-type-summary",
    ],

    queryFn:
      EmployeeDocumentTypeService.summary,

    staleTime: 1000 * 60 * 5,
  });
}