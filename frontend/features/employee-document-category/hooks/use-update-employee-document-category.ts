"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { EmployeeDocumentCategoryService } from "../services/employee-document-category-service";

import type { UpdateEmployeeDocumentCategory } from "../types/update-employee-document-category";

import { EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY } from "./use-employee-document-categories";

export function useUpdateEmployeeDocumentCategory(options?: {
  suppressToast?: boolean;
}) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateEmployeeDocumentCategory;
    }) => EmployeeDocumentCategoryService.update(id, data),

    onSuccess: (_data, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "employee-document-categories",
            "detail",
            variables.id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);

      if (suppressToast) return;
      toast.success("Document Category updated successfully.");
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
          "Unable to update Document Category.",
      );
    },
  });
}
