"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

export function useResetEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      EmployeeDocumentService.resetVerification(id),

    onSuccess: (_data, id) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["employee-document", id] }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-history", id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-summary"],
        }),
      ]);
    },
  });
}
