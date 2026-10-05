"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { BranchService } from "../services/branch-service";

export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      BranchService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["branches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "branches"],
      });

      toast.success(
        "Branch deleted successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to delete Branch."
      );
    },
  });
}
