"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { EmployeeDocumentTypeService } from "../services/employee-document-type-service";

import type { UpdateEmployeeDocumentType } from "../types/update-employee-document-type";

import { EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY } from "./use-employee-document-types";

export function useUpdateEmployeeDocumentType(options?: {
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
      data: UpdateEmployeeDocumentType;
    }) => EmployeeDocumentTypeService.update(id, data),

    onSuccess: (_data, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_DOCUMENT_TYPE_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["employee-document-types", "detail", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-readiness"],
        }),
      ]);

      if (suppressToast) return;
      toast.success("Document Type updated successfully.");
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
          "Unable to update Document Type.",
      );
    },
  });
}
