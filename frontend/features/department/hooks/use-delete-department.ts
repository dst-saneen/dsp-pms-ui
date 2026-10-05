"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { DepartmentService } from "../services/department-service";

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      DepartmentService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["departments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "departments"],
      });

      toast.success(
        "Department deleted successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to delete Department."
      );
    },
  });
}
