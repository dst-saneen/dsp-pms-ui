"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

import type { EmployeeDocumentSearch } from "../types/employee-document-search";

export const EMPLOYEE_DOCUMENT_QUERY_KEY = [
  "employee-documents",
];

export function useEmployeeDocuments(
  params?: EmployeeDocumentSearch,
) {
  return useQuery({
    queryKey: [
      ...EMPLOYEE_DOCUMENT_QUERY_KEY,
      params,
    ],

    queryFn: () =>
      EmployeeDocumentService.getAll(params),
  });
}