"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmployeeDocumentService } from "../services/employee-document-service";

function invalidateDocumentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["employee-documents"] }),
    queryClient.invalidateQueries({ queryKey: ["employee-document", id] }),
    queryClient.invalidateQueries({
      queryKey: ["employee-document-history", id],
    }),
    queryClient.invalidateQueries({
      queryKey: ["employee-document-summary"],
    }),
  ]);
}

export function useVerifyEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      remarks,
    }: {
      id: string;
      remarks?: string;
    }) => EmployeeDocumentService.verify(id, remarks),

    onSuccess: (_data, variables) => {
      void invalidateDocumentQueries(queryClient, variables.id);
    },
  });
}
