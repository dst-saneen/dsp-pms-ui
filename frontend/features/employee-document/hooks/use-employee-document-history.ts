"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

export function useEmployeeDocumentHistory(id: string) {
  return useQuery({
    queryKey: ["employee-document-history", id],
    queryFn: () => EmployeeDocumentService.getHistory(id),
    enabled: !!id,
  });
}
