"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

export function useEmployeeDocument(id: string) {
  return useQuery({
    queryKey: ["employee-document", id],

    queryFn: () =>
      EmployeeDocumentService.getById(id),

    enabled: !!id,
  });
}