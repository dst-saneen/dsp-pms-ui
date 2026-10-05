"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentCategoryService } from "../services/employee-document-category-service";

import type { EmployeeDocumentCategorySearch } from "../types/employee-document-category-search";

export const EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY = [
  "employee-document-categories",
];

export function useEmployeeDocumentCategories(
  params?: EmployeeDocumentCategorySearch,
) {
  return useQuery({
    queryKey: [
      ...EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY,
      params,
    ],

    queryFn: () =>
      EmployeeDocumentCategoryService.getEmployeeDocumentCategories(
        params,
      ),
  });
}