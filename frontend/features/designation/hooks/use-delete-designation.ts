"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { DesignationService } from "../services/designation-service";

export function useDeleteDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      DesignationService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["designations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "designations"],
      });

      toast.success(
        "Designation deleted successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to delete Designation."
      );
    },
  });
}
