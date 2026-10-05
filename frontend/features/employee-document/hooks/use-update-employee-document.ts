"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

import type { UpdateEmployeeDocument } from "../types/update-employee-document";

export function useUpdateEmployeeDocument(options?: {
  suppressToast?: boolean;
}) {
  const queryClient = useQueryClient();
  void options;

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateEmployeeDocument;
    }) => EmployeeDocumentService.update(id, data),

    onSuccess: (_data, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["employee-documents"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-summary"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);
    },
  });
}
