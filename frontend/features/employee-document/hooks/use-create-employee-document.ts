"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

import type { CreateEmployeeDocument } from "../types/create-employee-document";

export function useCreateEmployeeDocument(options?: {
  suppressToast?: boolean;
}) {
  const queryClient = useQueryClient();
  void options;

  return useMutation({
    mutationFn: (data: CreateEmployeeDocument) =>
      EmployeeDocumentService.create(data),

    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["employee-documents"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-summary"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);
    },
  });
}
