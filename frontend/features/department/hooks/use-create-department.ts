"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { DepartmentService } from "../services/department-service";

import type { CreateDepartmentDto } from "../types/department";
import type { ApiError } from "@/types/api";

export function useCreateDepartment(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: (data: CreateDepartmentDto) =>
      DepartmentService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["departments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "departments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-readiness"],
      });

      if (suppressToast) return;
      toast.success(
        "Department created successfully."
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
          "Unable to create Department."
      );
    },
  });
}
