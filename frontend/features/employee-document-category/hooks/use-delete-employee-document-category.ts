"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { EmployeeDocumentCategoryService } from "../services/employee-document-category-service";

import { EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY } from "./use-employee-document-categories";

export function useDeleteEmployeeDocumentCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      EmployeeDocumentCategoryService.delete(
        id,
      ),

    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);

      toast.success("Document Category deleted successfully.");
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to delete Document Category.",
      );
    },
  });
}