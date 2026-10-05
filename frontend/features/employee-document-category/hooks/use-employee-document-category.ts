"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentCategoryService } from "../services/employee-document-category-service";

export function useEmployeeDocumentCategory(id?: string) {
  return useQuery({
    queryKey: ["employee-document-categories", "detail", id],
    queryFn: () =>
      EmployeeDocumentCategoryService.getEmployeeDocumentCategory(id!),
    enabled: Boolean(id),
  });
}
