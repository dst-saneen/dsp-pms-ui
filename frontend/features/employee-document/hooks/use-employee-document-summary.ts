"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

export function useEmployeeDocumentSummary() {
  return useQuery({
    queryKey: ["employee-document-summary"],

    queryFn:
      EmployeeDocumentService.summary,

    staleTime: 1000 * 60 * 5,
  });
}