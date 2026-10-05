"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

export function useDeleteEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      EmployeeDocumentService.delete(id),

    onSuccess: (_, id) => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["employee-documents"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-summary"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document", id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);
    },
  });
}