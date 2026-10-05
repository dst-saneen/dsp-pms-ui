"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { BranchService } from "../services/branch-service";

import type { UpdateBranchDto } from "../types/branch";

import type { ApiError } from "@/types/api";

export function useUpdateBranch(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateBranchDto;
    }) =>
      BranchService.update(id, data),

    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["branches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["branches", "detail", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "branches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-readiness"],
      });

      if (suppressToast) return;
      toast.success(
        "Branch updated successfully."
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
        "Unable to update Branch."
      );
    },
  });
}
