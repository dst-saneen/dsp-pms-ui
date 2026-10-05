"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { EmployeeDocumentCategoryService } from "../services/employee-document-category-service";

import type { CreateEmployeeDocumentCategory } from "../types/create-employee-document-category";

import type { ApiError } from "@/types/api";

import { EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY } from "./use-employee-document-categories";

export function useCreateEmployeeDocumentCategory(options?: {
  suppressToast?: boolean;
}) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: (data: CreateEmployeeDocumentCategory) =>
      EmployeeDocumentCategoryService.create(data),

    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_DOCUMENT_CATEGORY_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);

      if (suppressToast) return;
      toast.success("Document Category created successfully.");
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
          "Unable to create Document Category.",
      );
    },
  });
}
