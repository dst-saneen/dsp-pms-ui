"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

export function useRejectEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      remarks,
    }: {
      id: string;
      remarks: string;
    }) => EmployeeDocumentService.reject(id, remarks),

    onSuccess: (_data, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee-documents"] }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-history", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-summary"],
        }),
      ]);
    },
  });
}
