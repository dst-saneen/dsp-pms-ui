"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentTypeService } from "../services/employee-document-type-service";

export function useEmployeeDocumentType(id?: string) {
  return useQuery({
    queryKey: ["employee-document-types", "detail", id],
    queryFn: () => EmployeeDocumentTypeService.getById(id!),
    enabled: Boolean(id),
  });
}
