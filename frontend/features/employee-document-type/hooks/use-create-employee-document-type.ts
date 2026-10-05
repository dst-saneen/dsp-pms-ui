"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { EmployeeDocumentTypeService } from "../services/employee-document-type-service";

import type { CreateEmployeeDocumentType } from "../types/create-employee-document-type";

import type { ApiError } from "@/types/api";

import { EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY } from "./use-employee-document-types";

export function useCreateEmployeeDocumentType(options?: {
  suppressToast?: boolean;
}) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: (data: CreateEmployeeDocumentType) =>
      EmployeeDocumentTypeService.create(data),

    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);

      if (suppressToast) return;
      toast.success("Document Type created successfully.");
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
          "Unable to create Document Type.",
      );
    },
  });
}
