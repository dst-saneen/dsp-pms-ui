"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { DepartmentService } from "../services/department-service";

import type { UpdateDepartmentDto } from "../types/department";

import type { ApiError } from "@/types/api";

export function useUpdateDepartment(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateDepartmentDto;
    }) =>
      DepartmentService.update(id, data),

    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["departments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["departments", "detail", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "departments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-readiness"],
      });

      if (suppressToast) return;
      toast.success(
        "Department updated successfully."
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
        "Unable to update Department."
      );
    },
  });
}
