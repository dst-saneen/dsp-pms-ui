"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentTypeService } from "../services/employee-document-type-service";

import type { EmployeeDocumentTypeSearch } from "../types/employee-document-type-search";

export const EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY = [
  "employee-document-types",
];

export function useEmployeeDocumentTypes(
  params?: EmployeeDocumentTypeSearch,
) {
  return useQuery({
    queryKey: [
      ...EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY,
      params,
    ],

    queryFn: () =>
      EmployeeDocumentTypeService.getAll(params),
  });
}