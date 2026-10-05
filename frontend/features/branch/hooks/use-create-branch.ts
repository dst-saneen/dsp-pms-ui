"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { BranchService } from "../services/branch-service";

import type { CreateBranchDto } from "../types/branch";

import type { ApiError } from "@/types/api";

export function useCreateBranch(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: (data: CreateBranchDto) =>
      BranchService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["branches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "branches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-readiness"],
      });

      if (suppressToast) return;
      toast.success(
        "Branch created successfully."
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
        "Unable to create Branch."
      );
    },
  });
}
