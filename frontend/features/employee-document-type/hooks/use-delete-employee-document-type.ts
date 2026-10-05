"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { EmployeeDocumentTypeService } from "../services/employee-document-type-service";

import { EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY } from "./use-employee-document-types";

export function useDeleteEmployeeDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      EmployeeDocumentTypeService.delete(id),

    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);

      toast.success("Document Type deleted successfully.");
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to delete Document Type.",
      );
    },
  });
}